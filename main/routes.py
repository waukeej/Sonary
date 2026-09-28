from flask import Blueprint, render_template, g, redirect, url_for, abort
from diary import queries as track_queries
from diary.routes import diary_page, activity_data, view_track
from profile_backend.routes import profile_data
from permissions import login_required
from playlists.routes import playlist_page, view_playlist
from playlists import queries as playlist_queries

bp = Blueprint('main', __name__)


@bp.get('/')
def index():
    return render_template('index.html')

@bp.get('/diary')
@login_required
def diary():
    return diary_page()


@bp.get('/profile')
@login_required
def profile():
    return render_template('profile.html', profile=profile_data(g.user),
                           profile_playlists=[view_playlist(r) for r in playlist_queries.list_owned(g.user['user_id'])
                                              if not r.get('system_key')],
                           profile_tracks=[view_track(row) for row in track_queries.list_owned(g.user['user_id'])],
                           diary_activity=activity_data(g.user))


@bp.get('/calendar')
@login_required
def calendar():
    return render_template('calendar.html', diary_activity=activity_data(g.user),
                           calendar_tracks=[view_track(row) for row in track_queries.list_owned(g.user['user_id'])])


@bp.get('/playlists')
@login_required
def playlists():
    return playlist_page()


@bp.get('/playlist/id')
@login_required
def playlist_id():
    rows = playlist_queries.list_owned(g.user['user_id'])
    if not rows:
        abort(404)
    return redirect(url_for('playlists.detail', playlist_id=rows[0]['playlist_id']))


@bp.get('/track')
@login_required
def track():
    rows = track_queries.list_owned(g.user['user_id'])
    if not rows:
        abort(404)
    return redirect(url_for('diary.detail', track_id=rows[0]['track_id']))


@bp.get('/test_load')
@login_required
def test_load():
    return render_template('test_load.html')


@bp.get('/test_animation')
@login_required
def test_animation():
    return render_template('test_animation.html')
