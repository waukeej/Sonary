from flask import Blueprint, abort, g, jsonify, request, send_file, url_for
from auth.queries import find_user
from permissions import login_required
from profile_backend import services
from diary.queries import count_owned
from playlists.queries import count_owned as playlist_count

bp = Blueprint('profile_backend', __name__, url_prefix='/settings')


def profile_data(user):
    return dict(id=user['user_id'], username=user['username'], email=user['email'],
                display_name=user['display_name'], name=user['display_name'] or user['username'],
                bio=user['bio'], city=user['city'], location=user['city'],
                avatar_url=url_for('profile_backend.avatar', filename=user['avatar_filename']) if user['avatar_filename'] else '',
                profile_visibility=user['profile_visibility'],
                joined_date=user['created_at'].strftime('%d.%m.%Y') if user['created_at'] else '—',
                track_count=count_owned(user['user_id']), playlist_count=playlist_count(user['user_id']))


@bp.get('/profile')
@login_required
def read_profile():
    return jsonify(profile=profile_data(g.user))


@bp.post('/profile')
@login_required
def update_profile():
    data = request.get_json(silent=True) if request.is_json else request.form
    if not isinstance(data, dict) and not hasattr(data, 'getlist'):
        return jsonify(errors={'form': 'Некорректный запрос.'}), 400
    errors = services.update_profile(g.user, data, request.files)
    if errors:
        return jsonify(errors=errors), 400
    g.user = find_user(g.user['user_id'])
    return jsonify(profile=profile_data(g.user))


@bp.get('/avatar/<filename>')
@login_required
def avatar(filename):
    if filename != g.user['avatar_filename']:
        abort(404)
    try:
        path = services.avatar_path(filename)
    except ValueError:
        abort(404)
    if not path.is_file():
        abort(404)
    response = send_file(path, mimetype='image/png', conditional=False)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
