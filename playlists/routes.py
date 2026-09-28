from datetime import date
from flask import Blueprint, abort, g, jsonify, redirect, render_template, request, send_file, url_for
from permissions import login_required
from diary.routes import view_track, playback_track
from diary.services import MOODS, ALIASES
from playlists import queries, services

bp = Blueprint('playlists', __name__)

def view_playlist(row):
    system_cover = {'liked': 'ponravivshiesya.png', 'mood:calm': 'spokoinoe.png', 'mood:happy': 'veseloe.png',
                    'mood:sad': 'grustnoe.png', 'mood:energetic': 'energichnoe.png'}.get(row.get('system_key'))
    cover = (url_for('static', filename='images/' + system_cover) if system_cover else
             url_for('playlists.cover', playlist_id=row['playlist_id']) if row['cover_filename'] else
             url_for('static', filename='images/sonary-logo.jpg'))
    return dict(row, id=row['playlist_id'], detail_url=url_for('playlists.detail', playlist_id=row['playlist_id']),
                track_count=len(queries.tracks(row['playlist_id'], g.user['user_id'])),
                cover=cover,
                date=row['created_at'].strftime('%d.%m.%Y'), time=row['created_at'].strftime('%H:%M'))

def playlist_page(errors=None):
    filters, filter_errors = {}, {}
    mood = ALIASES.get(request.args.get('mood', ''), request.args.get('mood', ''))
    if mood in MOODS:
        filters['mood'] = mood
    else:
        filter_errors['mood'] = 'Выберите настроение из списка.'
    for key in ('date_from', 'date_to'):
        if request.args.get(key):
            try:
                filters[key] = date.fromisoformat(request.args[key])
            except ValueError:
                filter_errors[key] = 'Укажите корректную дату не позже сегодняшней.'
    return render_template('playlists.html', playlists=[view_playlist(r) for r in queries.list_owned(g.user['user_id'], filters)],
                           filters=filters, filter_errors=filter_errors, playlist_errors=errors or {}, form_values=request.form)

def failed(errors, playlist_id=None):
    if request.accept_mimetypes.best == 'application/json':
        return jsonify(errors=errors), 400
    if playlist_id:
        row = services.permitted(queries.find(playlist_id), g.user, True)
        return render_template('playlist-id.html', playlist=view_playlist(row), can_edit=True,
                               playlist_tracks=[view_track(t) for t in queries.tracks(playlist_id, g.user['user_id'])],
                               playlist_errors=errors, form_values=request.form), 400
    return playlist_page(errors), 400

@bp.post('/playlists')
@login_required
def create():
    id, errors = services.save(g.user, request.get_json(silent=True) if request.is_json else request.form, request.files)
    if errors:
        return failed(errors)
    return redirect(url_for('playlists.detail', playlist_id=id), code=303)

@bp.get('/playlist/<int:playlist_id>')
@login_required
def detail(playlist_id):
    row = services.permitted(queries.find(playlist_id), g.user)
    return render_template('playlist-id.html', playlist=view_playlist(row), can_edit=row['user_id'] == g.user['user_id'] and not row.get('system_key'),
                           playlist_tracks=[view_track(t) for t in queries.tracks(playlist_id, g.user['user_id'])], playlist_errors={})

@bp.post('/playlist/<int:playlist_id>/edit')
@login_required
def edit(playlist_id):
    _, errors = services.save(g.user, request.get_json(silent=True) if request.is_json else request.form, request.files, playlist_id)
    if errors:
        return failed(errors, playlist_id)
    return redirect(url_for('playlists.detail', playlist_id=playlist_id), code=303)

@bp.get('/playlist/<int:playlist_id>/playback')
@login_required
def playback(playlist_id):
    services.permitted(queries.find(playlist_id), g.user)
    return jsonify([playback_track(row) for row in queries.tracks(playlist_id, g.user['user_id']) if row['audio_filename']])

def selected(key, allowed):
    data = request.get_json(silent=True) if request.is_json else request.form
    if not data or set(data) - set(allowed) - {'csrf_token'}:
        raise ValueError()
    return services.ids(data, key)

@bp.post('/playlist/<int:playlist_id>/tracks/add')
@login_required
def add(playlist_id):
    services.permitted(queries.find(playlist_id), g.user, True)
    try:
        ids = selected('track_ids', ['track_ids'])
    except (ValueError, TypeError):
        return failed({'form': 'Выберите от 1 до 100 записей.'}, playlist_id)
    errors = services.add_tracks(g.user, [playlist_id], ids)
    if errors:
        return failed(errors, playlist_id)
    return redirect(url_for('playlists.detail', playlist_id=playlist_id), code=303)

@bp.post('/playlists/add-track')
@login_required
def add_from_track():
    try:
        playlist_ids = selected('playlist_ids', ['playlist_ids', 'track_id'])
        data = request.get_json(silent=True) if request.is_json else request.form
        track_id = int(data.get('track_id', 0))
        if track_id <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return failed({'form': 'Выберите плейлист и доступный трек.'})
    errors = services.add_tracks(g.user, playlist_ids, [track_id])
    if errors:
        return failed(errors)
    return redirect(url_for('playlists.detail', playlist_id=playlist_ids[0]), code=303)

@bp.post('/playlist/<int:playlist_id>/tracks/remove')
@login_required
def remove(playlist_id):
    services.permitted(queries.find(playlist_id), g.user, True)
    try:
        ids = selected('track_ids', ['track_ids'])
    except (ValueError, TypeError):
        return failed({'form': 'Выберите от 1 до 100 записей.'}, playlist_id)
    services.remove_tracks(g.user, playlist_id, ids)
    return redirect(url_for('playlists.detail', playlist_id=playlist_id), code=303)

@bp.post('/playlist/<int:playlist_id>/delete')
@login_required
def delete(playlist_id):
    services.delete(g.user, [playlist_id])
    return redirect(url_for('main.playlists'), code=303)

@bp.post('/playlists/delete')
@login_required
def delete_selected():
    try:
        ids = selected('playlist_ids', ['playlist_ids'])
    except (ValueError, TypeError):
        return failed({'form': 'Выберите от 1 до 100 плейлистов.'})
    services.delete(g.user, ids)
    return redirect(url_for('main.playlists'), code=303)

@bp.get('/media/playlists/<int:playlist_id>/cover')
@login_required
def cover(playlist_id):
    row = services.permitted(queries.find(playlist_id), g.user)
    try:
        target = services.cover_path(row['cover_filename'])
    except ValueError:
        abort(404)
    if not target.is_file():
        abort(404)
    response = send_file(target, mimetype='image/png', conditional=True)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
