from flask import Blueprint, g, request, session, jsonify, url_for
from flask_wtf.csrf import generate_csrf
from auth import queries, services
from auth import security
from auth import registration

bp = Blueprint('auth', __name__, url_prefix='/auth')


def load_current_user():
    g.user = None
    user_id = session.get('user_id')
    if user_id is not None:
        g.user = queries.find_user(user_id)
        if g.user is None:
            session.clear()


def signed_in(user_id):
    from playlists.system import ensure
    ensure(user_id)
    session.clear()
    session['user_id'] = user_id
    session['security_reminder'] = True
    session.permanent = True
    return jsonify(redirect=url_for('main.diary'))


@bp.get('/csrf')
def csrf():
    response = jsonify(csrf_token=generate_csrf())
    response.headers['Cache-Control'] = 'no-store'
    return response


@bp.post('/register')
def register():
    result, status = registration.begin(request.form)
    return jsonify(result), status


@bp.get('/registration/status')
def registration_status():
    result, status = registration.status()
    return jsonify(result), status


@bp.post('/registration/resend')
def registration_resend():
    result, status = registration.resend()
    return jsonify(result), status


@bp.post('/registration/confirm')
def registration_confirm():
    result, status = registration.confirm(request.form)
    if 'authenticated_user' in result:
        return signed_in(result['authenticated_user']), 201
    return jsonify(result), status


@bp.post('/check-registration')
def check_registration():
    availability, field, error = services.check_registration_availability(request.form)
    if error:
        return jsonify(error=error, field=field), 400
    response = jsonify(availability)
    response.headers['Cache-Control'] = 'no-store'
    return response


@bp.post('/login')
def login():
    user_id = services.authenticate(request.form.get('identity', ''), request.form.get('password', ''))
    if user_id is None:
        return jsonify(error='Неверный логин или пароль.'), 401
    result, status = security.start_login(user_id)
    if 'authenticated_user' in result:
        return signed_in(result['authenticated_user'])
    return jsonify(result), status


@bp.post('/second-factor')
def second_factor():
    result, status = security.verify_login(request.form)
    if 'authenticated_user' in result:
        return signed_in(result['authenticated_user'])
    return jsonify(result), status


@bp.post('/second-factor/resend')
def second_factor_resend():
    result, status = security.resend_login()
    return jsonify(result), status


@bp.post('/check-identity')
def check_identity():
    identity = request.form.get('identity', '').strip()
    # Email identities proceed without revealing whether an address is registered.
    # Public usernames may be checked here purely to improve the sign-in flow.
    is_email = '@' in identity
    if (not identity or len(identity) > 255 or
            (not is_email and not queries.username_exists(identity))):
        return jsonify(exists=False, error='Аккаунт с таким логином или почтой не найден.', field='identity')
    response = jsonify(exists=True)
    response.headers['Cache-Control'] = 'no-store'
    return response


@bp.post('/logout')
def logout():
    session.clear()
    return jsonify(redirect=url_for('main.index'))
