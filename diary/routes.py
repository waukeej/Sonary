from datetime import date
from flask import Blueprint, abort, g, jsonify, redirect, render_template, request, send_file, url_for
from permissions import login_required
from diary import queries, services, media

bp = Blueprint('diary', __name__)

@bp.get('/tracks/likes')
@login_required
def liked_tracks():
    from database import get_db
    return jsonify(ids=[r['track_id'] for r in get_db().execute(
        "SELECT l.track_id FROM track_likes l JOIN tracks t USING(track_id) WHERE l.user_id=%s "
        "AND (t.user_id=%s OR t.privacy='public')", (g.user['user_id'],g.user['user_id'])).fetchall()])

@bp.post('/track/<int:track_id>/like')
@login_required
def like(track_id):
    from database import get_db
    from playlists.system import set_like
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or set(data) != {'liked'} or type(data['liked']) is not bool:
        abort(400)
    with get_db().transaction():
        services.permitted(queries.find(track_id, lock=True), g.user)
        set_like(g.user['user_id'],track_id,data['liked'])
    return jsonify(id=track_id,liked=data['liked'])

def view_track(row):
    duration = int(row['duration_seconds'] or 0)
    return dict(row, id=row['track_id'], description=row['short_description'], summary=row['short_description'],
                date=row['entry_date'].strftime('%d.%m.%Y') if row['entry_date'] else '—',
                time=row['entry_time'].strftime('%H:%M') if row['entry_time'] else '—',
                date_iso=row['entry_date'].isoformat() if row['entry_date'] else '',
                time_iso=row['entry_time'].strftime('%H:%M') if row['entry_time'] else '',
                mood_code=row['mood'], mood=services.MOODS.get(row['mood'], '—'),
                duration_seconds=duration, duration=f'{duration//60}:{duration%60:02}',
                detail_url=url_for('diary.detail', track_id=row['track_id']),
                cover=url_for('diary.track_media', track_id=row['track_id'], kind='cover') if row['cover_filename'] else url_for('static', filename='images/sonary-logo.jpg'),
                audio_url=url_for('diary.track_media', track_id=row['track_id'], kind='audio') if row['audio_filename'] else '')

def activity_data(user):
    rows = queries.list_owned(user['user_id'])
    dates = [r['entry_date'] for r in rows if r['entry_date']]
    start = user['created_at'].date() if user['created_at'] else (min(dates) if dates else date.today())
    if dates:
        start = min(start, min(dates))
    return dict(start=start.isoformat(), entries=[{'id': r['track_id'], 'date': r['entry_date'].isoformat()} for r in rows if r['entry_date']])

def diary_page(errors=None, form_values=None):
    filters, filter_errors = {}, {}
    mood = request.args.get('mood', '')
    mood = services.ALIASES.get(mood, mood)
    if mood not in services.MOODS:
        filter_errors['mood'] = 'Выберите настроение из списка.'
    else:
        filters['mood'] = mood
    sort = request.args.get('sort', '')
    if sort not in queries.SORTS:
        filter_errors['sort'] = 'Выберите сортировку из списка.'
    else:
        filters['sort'] = sort
    for key in ('date_from', 'date_to'):
        if request.args.get(key):
            try:
                filters[key] = date.fromisoformat(request.args[key])
            except ValueError:
                filter_errors[key] = 'Укажите корректную дату не позже сегодняшней.'
    return render_template('diary.html', tracks=[view_track(r) for r in queries.list_owned(g.user['user_id'], filters)],
                           filters=filters, filter_errors=filter_errors, track_errors=errors or {}, form_values=form_values or {})

def failed(errors, track_id=None):
    if request.accept_mimetypes.best == 'application/json':
        return jsonify(errors=errors), 400
    if track_id:
        row = services.permitted(queries.find(track_id), g.user, True)
        return render_template('track.html', track=view_track(row), can_edit=True, track_errors=errors,
                               form_values=request.form), 400
    return diary_page(errors, request.form), 400

@bp.post('/tracks')
@login_required
def create():
    track_id, errors = services.save(g.user, request.get_json(silent=True) if request.is_json else request.form, request.files)
    if errors:
        return failed(errors)
    return redirect(url_for('diary.detail', track_id=track_id), code=303)

@bp.get('/track/<int:track_id>')
@login_required
def detail(track_id):
    row = services.permitted(queries.find(track_id), g.user)
    return render_template('track.html', track=view_track(row), can_edit=row['user_id'] == g.user['user_id'], track_errors={})

def playback_track(row):
    track = view_track(row)
    return dict({key: track[key] for key in ('id', 'title', 'artist', 'cover', 'audio_url', 'duration_seconds')},
                normalization_gain_db=media.loudness(row['audio_filename']).get('gain_db', 0))

@bp.get('/track/<int:track_id>/playback')
@login_required
def playback(track_id):
    return jsonify(playback_track(services.permitted(queries.find(track_id), g.user)))

@bp.post('/track/<int:track_id>/edit')
@login_required
def edit(track_id):
    _, errors = services.save(g.user, request.get_json(silent=True) if request.is_json else request.form, request.files, track_id)
    if errors:
        return failed(errors, track_id)
    return redirect(url_for('diary.detail', track_id=track_id), code=303)

@bp.post('/track/<int:track_id>/delete')
@login_required
def delete(track_id):
    errors = services.delete(g.user, [track_id])
    if errors:
        return failed(errors, track_id)
    return redirect(url_for('main.diary'), code=303)

@bp.post('/tracks/delete')
@login_required
def delete_selected():
    try:
        if set(request.form) - {'track_ids', 'csrf_token'}:
            raise ValueError()
        ids = [int(value) for value in request.form.getlist('track_ids')]
        if not ids or len(ids) > 100 or any(value <= 0 for value in ids):
            raise ValueError()
    except ValueError:
        return failed({'form': 'Выберите от 1 до 100 записей.'})
    errors = services.delete(g.user, ids)
    if errors:
        return failed(errors)
    return redirect(url_for('main.diary'), code=303)

@bp.get('/media/tracks/<int:track_id>/<kind>')
@login_required
def track_media(track_id, kind):
    if kind not in ('audio', 'cover'):
        abort(404)
    row = services.permitted(queries.find(track_id), g.user)
    filename = row[kind + '_filename']
    try:
        target = media.path(kind, filename)
    except ValueError:
        abort(404)
    if not target.is_file():
        abort(404)
    mimetype = 'image/png' if kind == 'cover' else 'audio/wav' if filename.endswith('.wav') else 'audio/mpeg'
    response = send_file(target, mimetype=mimetype, conditional=True)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
