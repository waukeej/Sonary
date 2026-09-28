import re
from pathlib import Path
from uuid import uuid4
from flask import current_app, abort
from database import get_db
from diary import queries as track_queries, services as track_services, media
from playlists import queries

def permitted(row, user, write=False):
    row = track_services.permitted(row, user, write)
    if write and row.get('system_key'):
        abort(403)
    return row

def ids(data, key):
    values = data.getlist(key) if hasattr(data, 'getlist') else data.get(key, [])
    if not isinstance(values, list) or not 1 <= len(values) <= 100:
        raise ValueError()
    if any(isinstance(v, bool) or not re.fullmatch(r'[1-9][0-9]*', str(v)) for v in values):
        raise ValueError()
    return sorted(set(int(v) for v in values))

def cover_path(filename):
    if not filename or not re.fullmatch(r'[a-f0-9]{32}\.png', filename):
        raise ValueError('Invalid cover filename')
    return Path(current_app.config['PLAYLIST_COVER_FOLDER']) / filename

def remove_cover(filename):
    if not filename:
        return
    try:
        if media.referenced('playlists', 'cover_filename', filename):
            return
        cover_path(filename).unlink(missing_ok=True)
    except (OSError, ValueError):
        current_app.logger.exception('Playlist cover cleanup failed')

def owned_tracks(user, track_ids):
    for track_id in track_ids:
        row = track_queries.find(track_id, lock=True)
        if not row or row['user_id'] != user['user_id']:
            return {'form': 'Выбранный трек недоступен.'}
    return {}

def save(user, data, files, playlist_id=None):
    old = permitted(queries.find(playlist_id), user, True) if playlist_id else None
    if not isinstance(data, dict) and not hasattr(data, 'getlist'):
        return None, {'form': 'Некорректный запрос.'}
    if set(data) - {'playlistTitle', 'playlistDescription', 'privacy', 'csrf_token', 'track_ids'} or set(files) - {'playlistCover'}:
        return None, {'form': 'Запрос содержит недопустимые поля.'}
    fields, errors = {}, {}
    for name, column, limit in [('playlistTitle', 'title', 255), ('playlistDescription', 'description', 10000)]:
        if name not in data and old:
            continue
        value = data.get(name, '')
        if not isinstance(value, str) or '\x00' in value or len(value) > limit:
            errors[name] = 'Проверьте длину и содержимое поля.'
            continue
        value = value.strip()
        if column == 'title' and not value:
            errors[name] = 'Укажите название плейлиста.'
        if column == 'description' and len(value.split()) > 50:
            errors[name] = 'Описание плейлиста: не более 50 слов.'
        fields[column] = value
    if 'privacy' in data or not old:
        privacy = data.get('privacy', 'private')
        if privacy not in ('public', 'private'):
            errors['privacy'] = 'Этот режим приватности пока недоступен.'
        else:
            fields['privacy'] = privacy
    selected = []
    if 'track_ids' in data:
        try:
            selected = ids(data, 'track_ids')
        except (ValueError, TypeError):
            errors['form'] = 'Выберите от 1 до 100 записей.'
    content = None
    upload = files.get('playlistCover')
    if upload and upload.filename:
        try:
            content = media.image(media.read_bounded(upload, current_app.config['TRACK_COVER_MAX_BYTES'], 'Обложка должна быть не больше 5 МБ.'))
        except media.InvalidMedia as error:
            errors['playlistCover'] = str(error)
    if errors:
        return None, errors
    new_filename = None
    created_file = False
    try:
        with get_db().transaction():
            if playlist_id:
                old = permitted(queries.find(playlist_id, lock=True), user, True)
            errors = owned_tracks(user, selected)
            if errors:
                return None, errors
            if content is not None:
                new_filename = uuid4().hex + '.png'
                target = cover_path(new_filename)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as output:
                    created_file = True
                    output.write(content)
                fields['cover_filename'] = new_filename
            if playlist_id:
                if fields:
                    queries.update(playlist_id, fields)
            else:
                playlist_id = queries.insert(user['user_id'], fields)
            queries.add(playlist_id, selected)
    except Exception:
        if created_file:
            remove_cover(new_filename)
        raise
    if new_filename and old:
        remove_cover(old['cover_filename'])
    return playlist_id, {}

def add_tracks(user, playlist_ids, track_ids):
    with get_db().transaction():
        for id in sorted(playlist_ids):
            permitted(queries.find(id, lock=True), user, True)
        errors = owned_tracks(user, track_ids)
        if errors:
            return errors
        for id in playlist_ids:
            queries.add(id, track_ids)
    return {}

def remove_tracks(user, id, track_ids):
    with get_db().transaction():
        permitted(queries.find(id, lock=True), user, True)
        queries.remove(id, track_ids)

def delete(user, playlist_ids):
    covers = []
    with get_db().transaction():
        for id in sorted(playlist_ids):
            row = permitted(queries.find(id, lock=True), user, True)
            covers.append(row['cover_filename'])
            queries.delete(id)
    for filename in covers:
        remove_cover(filename)
