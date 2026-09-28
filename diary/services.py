import re
from datetime import date, datetime, time
from flask import abort, current_app
from psycopg.errors import ForeignKeyViolation
from database import get_db
from diary import queries, media

MOODS = {'': '—', 'happy': 'Радостное', 'calm': 'Спокойное', 'sad': 'Грустное', 'energetic': 'Энергичное'}
ALIASES = {v: k for k, v in MOODS.items() if k}

def permitted(row, user, write=False):
    if not row or (write and row['user_id'] != user['user_id']) or (not write and row['privacy'] != 'public' and row['user_id'] != user['user_id']):
        abort(404)
    return row

def validate(data, files, old=None):
    if not isinstance(data, dict) and not hasattr(data, 'getlist'):
        return {}, {}, {'form': 'Некорректный запрос.'}
    allowed = {'title', 'artist', 'shortDescription', 'fullDescription', 'trackDate', 'trackTime', 'trackRating', 'trackMood', 'privacy', 'csrf_token'}
    if set(data) - allowed or set(files) - {'trackFile', 'cover'}:
        return {}, {}, {'form': 'Запрос содержит недопустимые поля.'}
    fields, errors, prepared = {}, {}, {}
    for name, column, limit in [('title', 'title', 255), ('artist', 'artist', 255),
                                ('shortDescription', 'short_description', 10000), ('fullDescription', 'full_description', 80000)]:
        if name not in data:
            if not old:
                fields[column] = ''
            continue
        value = data.get(name)
        if not isinstance(value, str) or '\x00' in value or len(value) > limit:
            errors[name] = 'Проверьте длину и содержимое поля.'
            continue
        value = value.strip()
        words = len(value.split())
        if name == 'shortDescription' and not 10 <= words <= 150:
            errors[name] = 'Краткое описание: от 10 до 150 слов.'
        if name == 'fullDescription' and words > 1000:
            errors[name] = 'Развёрнутое описание: до 1000 слов.'
        fields[column] = value
    if not old and not fields.get('short_description'):
        errors['shortDescription'] = 'Краткое описание: от 10 до 150 слов.'
    for name, column in [('trackDate', 'entry_date'), ('trackTime', 'entry_time')]:
        if name not in data and old:
            continue
        value = data.get(name, '')
        try:
            if not isinstance(value, str):
                raise ValueError()
            if column == 'entry_date':
                parsed = date.fromisoformat(value) if value else date.today()
                if parsed > date.today() or parsed.year < 1900:
                    raise ValueError()
            else:
                parsed = time.fromisoformat(value) if value else datetime.now().time().replace(microsecond=0)
                if parsed.tzinfo:
                    raise ValueError()
            fields[column] = parsed
        except ValueError:
            errors[name] = 'Укажите корректную дату не позже сегодняшней.' if column == 'entry_date' else 'Укажите корректное время.'
    if 'trackRating' in data or not old:
        value = data.get('trackRating', '0')
        if not isinstance(value, str) or not re.fullmatch(r'(?:[0-9]|10)', value):
            errors['trackRating'] = 'Оценка должна быть целым числом от 0 до 10.'
        else:
            fields['rating'] = int(value)
    if 'trackMood' in data or not old:
        value = data.get('trackMood', '')
        mood = ALIASES.get(value, value) if isinstance(value, str) else None
        if mood not in MOODS:
            errors['trackMood'] = 'Выберите настроение из списка.'
        else:
            fields['mood'] = mood
    if 'privacy' in data or not old:
        privacy = data.get('privacy', 'private')
        if privacy not in ('public', 'private'):
            errors['privacy'] = 'Этот режим приватности пока недоступен.'
        else:
            fields['privacy'] = privacy
    upload, metadata = files.get('trackFile'), {}
    if upload and upload.filename:
        try:
            content, extension, duration, metadata = media.audio(upload)
            prepared['audio'] = (content, extension, metadata['loudness'])
            fields['duration_seconds'] = duration
        except media.InvalidMedia as error:
            errors['trackFile'] = str(error)
    elif not old:
        errors['trackFile'] = 'Загрузите аудиофайл MP3 или WAV.'
    for column in ('title', 'artist'):
        if not (fields.get(column) or (old and old[column])) and metadata.get(column):
            fields[column] = metadata[column]
    if not fields.get('title', old['title'] if old else ''):
        errors['title'] = 'Укажите название трека.'
    cover = files.get('cover')
    if cover and cover.filename:
        try:
            prepared['cover'] = (media.image(media.read_bounded(cover, current_app.config['TRACK_COVER_MAX_BYTES'], 'Обложка должна быть не больше 5 МБ.')), 'png')
        except media.InvalidMedia as error:
            errors['cover'] = str(error)
    elif metadata.get('cover') and not (old and old['cover_filename']):
        prepared['cover'] = (metadata['cover'], 'png')
    return fields, prepared, errors

def save(user, data, files, track_id=None):
    old = permitted(queries.find(track_id), user, True) if track_id else None
    fields, prepared, errors = validate(data, files, old)
    if errors:
        return None, errors
    new_files, obsolete = [], []
    try:
        with get_db().transaction():
            if track_id:
                old = permitted(queries.find(track_id, lock=True), user, True)
            for kind, prepared_file in prepared.items():
                content, extension = prepared_file[:2]
                filename = media.store(kind, content, extension)
                new_files.append((kind, filename))
                if kind == 'audio':
                    import json
                    target = media.path(kind, filename)
                    target.with_suffix(target.suffix + '.json').write_text(json.dumps(prepared_file[2]), encoding='utf-8')
                fields[kind + '_filename'] = filename
                if old:
                    obsolete.append((kind, old[kind + '_filename']))
            if track_id:
                if fields:
                    queries.update(track_id, user['user_id'], fields)
            else:
                track_id = queries.insert(user['user_id'], fields)
            from playlists.system import sync_mood
            sync_mood(user['user_id'], track_id)
    except Exception:
        for kind, filename in new_files:
            media.remove(kind, filename)
        raise
    for kind, filename in obsolete:
        media.remove(kind, filename)
    return track_id, {}

def delete(user, ids):
    files = []
    try:
        with get_db().transaction():
            for track_id in sorted(set(ids)):
                row = permitted(queries.find(track_id, lock=True), user, True)
                queries.delete(track_id, user['user_id'])
                files.extend((kind, row[kind + '_filename']) for kind in ('audio', 'cover'))
    except ForeignKeyViolation:
        return {'form': 'Запись связана с другими данными и пока не может быть удалена.'}
    for kind, filename in files:
        media.remove(kind, filename)
    return {}
