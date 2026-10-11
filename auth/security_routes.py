from flask import Blueprint, g, jsonify, request, session
from auth import security
from database import get_db
from permissions import login_required

bp = Blueprint('security', __name__, url_prefix='/settings/security')


def response(result):
    payload, status = result
    return jsonify(payload), status


@bp.get('')
@login_required
def state():
    return response(security.settings_state(g.user))


@bp.post('/setup')
@login_required
def setup():
    return response(security.setup(g.user, request.form))


@bp.post('/gate')
@login_required
def gate():
    return response(security.gate(g.user, request.form))


@bp.post('/confirm')
@login_required
def confirm():
    return response(security.confirm_setup(g.user, request.form))


@bp.post('/resend')
@login_required
def resend():
    return response(security.resend_setup(g.user, request.form))


@bp.post('/confirmation-email')
@login_required
def confirmation_email():
    return response(security.send_confirmation(g.user, request.form))


@bp.post('/manage')
@login_required
def manage():
    return response(security.manage(g.user, request.form))


@bp.post('/reminder')
@login_required
def reminder():
    show = session.pop('security_reminder', False)
    row = get_db().execute('SELECT two_factor_enabled FROM user_security WHERE user_id=%s',
                           (g.user['user_id'],)).fetchone()
    return jsonify(show=bool(show and not (row and row['two_factor_enabled'])))
