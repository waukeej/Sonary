import base64
import hashlib
import hmac
import io
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps

import pyotp
import qrcode
from flask import current_app, session
from werkzeug.security import check_password_hash

from auth import mail
from database import get_db


class SecurityError(Exception):
    def __init__(self, message, status=400, field=None):
        self.message, self.status = message, status
        self.field = field


def atomic(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with get_db().transaction():
            try:
                return function(*args, **kwargs), 200
            except SecurityError as error:
                return {'error': error.message, 'field': error.field, 'retry_after': getattr(error, 'retry_after', None)}, error.status
    return wrapped


def now():
    return datetime.now(timezone.utc)


def digest(value):
    return hmac.new(current_app.config['SECRET_KEY'].encode(), value.encode(), hashlib.sha256).hexdigest()


def locked_security(user_id):
    db = get_db()
    db.execute('INSERT INTO user_security(user_id) VALUES (%s) ON CONFLICT DO NOTHING', (user_id,))
    return db.execute('SELECT * FROM user_security WHERE user_id=%s FOR UPDATE', (user_id,)).fetchone()


def public_state(row):
    return {'enabled': row['two_factor_enabled'], 'primary': row['primary_2fa_method'],
            'email': row['email_enabled'], 'totp': bool(row['totp_secret'])}


def check_lock(row):
    if row['locked_until'] and row['locked_until'] > now():
        raise SecurityError('Слишком много попыток. Попробуйте через 15 минут.', 429)


def failure(row):
    count = (0 if row['locked_until'] and row['locked_until'] <= now() else row['failures']) + 1
    get_db().execute('UPDATE user_security SET failures=%s, locked_until=%s WHERE user_id=%s',
                     (count, now() + timedelta(minutes=15) if count >= 5 else None, row['user_id']))
    raise SecurityError('Неверный или истёкший код подтверждения.')


def reset_failures(user_id):
    get_db().execute('UPDATE user_security SET failures=0, locked_until=NULL WHERE user_id=%s', (user_id,))


def require_password(row, password):
    check_lock(row)
    user = get_db().execute('SELECT password_hash FROM users WHERE user_id=%s', (row['user_id'],)).fetchone()
    if not password or len(password) > 128 or not check_password_hash(user['password_hash'], password):
        try:
            failure(row)
        except SecurityError as error:
            error.field = 'password'
            error.message = 'Проверьте текущий пароль.'
            raise


def issue(row, user, purpose, method, pending_secret=None):
    check_lock(row)
    if method not in ('email', 'totp'):
        raise SecurityError('Этот способ пока недоступен.')
    db = get_db()
    db.execute('DELETE FROM security_challenges WHERE user_id=%s AND expires_at <= now()', (row['user_id'],))
    if method == 'email':
        if row['last_sent_at'] and row['last_sent_at'] > now() - timedelta(seconds=60):
            error = SecurityError('Повторная отправка доступна через 60 секунд.', 429)
            error.retry_after = max(1, int((row['last_sent_at'] + timedelta(seconds=60) - now()).total_seconds()) + 1)
            raise error
        code = f'{secrets.randbelow(1000000):06d}'
        try:
            mail.send_otp(user['email'], code)
        except mail.MailUnavailable:
            raise SecurityError('Не удалось отправить письмо. Попробуйте позже.', 503) from None
        db.execute('UPDATE user_security SET last_sent_at=%s WHERE user_id=%s', (now(), row['user_id']))
    else:
        code = None
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM security_challenges WHERE user_id=%s AND purpose=%s', (row['user_id'], purpose))
    db.execute('''INSERT INTO security_challenges
        (token_hash,user_id,purpose,method,code_hash,pending_secret,email,revision,expires_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
        (digest(token), row['user_id'], purpose, method, digest(token + ':' + code) if code else None,
         pending_secret, user['email'], row['revision'], now() + timedelta(minutes=10 if method == 'email' else 5)))
    session['security_' + purpose] = token
    return token


def challenge(purpose, user_id=None):
    token = session.get('security_' + purpose, '')
    row = get_db().execute('SELECT * FROM security_challenges WHERE token_hash=%s AND purpose=%s',
                           (digest(token), purpose)).fetchone()
    if not row or (user_id is not None and row['user_id'] != user_id):
        raise SecurityError('Подтверждение истекло. Начните заново.', 401)
    return token, row


def validate_challenge(row, item):
    check_lock(row)
    if item['expires_at'] <= now() or item['attempts'] >= 5 or item['revision'] != row['revision']:
        raise SecurityError('Подтверждение истекло. Начните заново.', 401)
    user = get_db().execute('SELECT email FROM users WHERE user_id=%s', (row['user_id'],)).fetchone()
    if user['email'] != item['email']:
        raise SecurityError('Подтверждение истекло. Начните заново.', 401)


def totp_step(secret, code, last_step=-1):
    if not re.fullmatch(r'[0-9]{6}', code):
        return None
    otp = pyotp.TOTP(secret)
    step = int(time.time()) // 30
    for candidate in (step, step - 1, step + 1):
        if candidate > last_step and hmac.compare_digest(otp.at(candidate * 30), code):
            return candidate
    return None


def verify(row, item, token, code, recovery=False):
    validate_challenge(row, item)
    code = code.strip()[:128]
    db = get_db()
    db.execute('UPDATE security_challenges SET attempts=attempts+1 WHERE token_hash=%s', (item['token_hash'],))
    if recovery:
        normalized = code.replace('-', '').replace(' ', '').upper()
        valid = db.execute('DELETE FROM security_recovery_codes WHERE user_id=%s AND code_hash=%s RETURNING user_id',
                           (row['user_id'], digest('recovery:' + normalized))).fetchone()
    elif item['method'] == 'email':
        valid = bool(item['code_hash']) and hmac.compare_digest(digest(token + ':' + code), item['code_hash'])
    else:
        step = totp_step(item['pending_secret'] or row['totp_secret'], code,
                         -1 if item['pending_secret'] else row['last_totp_step'])
        valid = step is not None
        if valid:
            db.execute('UPDATE user_security SET last_totp_step=%s WHERE user_id=%s', (step, row['user_id']))
    if not valid:
        failure(row)
    db.execute('DELETE FROM security_challenges WHERE token_hash=%s', (item['token_hash'],))
    reset_failures(row['user_id'])


def recovery_codes(user_id):
    db = get_db()
    db.execute('DELETE FROM security_recovery_codes WHERE user_id=%s', (user_id,))
    codes = []
    for _ in range(10):
        raw = secrets.token_hex(8).upper()
        codes.append('-'.join(raw[i:i + 4] for i in range(0, 16, 4)))
        db.execute('INSERT INTO security_recovery_codes(user_id,code_hash) VALUES (%s,%s)',
                   (user_id, digest('recovery:' + raw)))
    return codes


def active_email(row, user):
    return row['email_enabled'] and row['verified_email'] == user['email']


def authorize_change(row, user, data):
    require_password(row, data.get('password', ''))
    authorize_factor(row, user, data)


def authorize_factor(row, user, data):
    if not row['two_factor_enabled']:
        return
    method = data.get('confirmation_method', row['primary_2fa_method'])
    if method not in (row['primary_2fa_method'], 'recovery'):
        raise SecurityError('Этот способ пока недоступен.')
    code = data.get('confirmation_code', '').strip()[:128]
    if method == 'recovery':
        raw = code.replace('-', '').replace(' ', '').upper()
        valid = get_db().execute('DELETE FROM security_recovery_codes WHERE user_id=%s AND code_hash=%s RETURNING user_id',
                                 (row['user_id'], digest('recovery:' + raw))).fetchone()
        if not valid:
            failure(row)
    elif method == 'totp' and row['totp_secret']:
        step = totp_step(row['totp_secret'], code, row['last_totp_step'])
        if step is None:
            failure(row)
        get_db().execute('UPDATE user_security SET last_totp_step=%s WHERE user_id=%s', (step, row['user_id']))
    elif method == 'email' and active_email(row, user):
        token, item = challenge('reauth', row['user_id'])
        if item['method'] != 'email':
            raise SecurityError('Этот способ пока недоступен.')
        verify(row, item, token, code)
        session.pop('security_reauth', None)
    else:
        raise SecurityError('Этот способ пока недоступен.')
    reset_failures(row['user_id'])


def bump(row, user=None):
    expires_at = None
    if user and session.get('security_gate', {}).get('stage') == 'verified':
        _, grant = challenge('reauth', row['user_id'])
        validate_challenge(row, grant)
        expires_at = grant['expires_at']
    get_db().execute('UPDATE user_security SET revision=revision+1, updated_at=now() WHERE user_id=%s', (row['user_id'],))
    get_db().execute('DELETE FROM security_challenges WHERE user_id=%s', (row['user_id'],))
    session.pop('security_gate', None)
    if expires_at:
        gate_record(locked_security(row['user_id']), user, 'verified', 'overview', '', expires_at)


def gate_record(row, user, stage, action, method, expires_at=None):
    token = secrets.token_urlsafe(32)
    get_db().execute("DELETE FROM security_challenges WHERE user_id=%s AND purpose='reauth'", (row['user_id'],))
    get_db().execute('''INSERT INTO security_challenges
        (token_hash,user_id,purpose,method,email,revision,expires_at)
        VALUES (%s,%s,'reauth',%s,%s,%s,%s)''',
        (digest(token), row['user_id'], row['primary_2fa_method'] or 'totp', user['email'], row['revision'], expires_at or now() + timedelta(seconds=120 if stage == 'verified' else 600)))
    session['security_reauth'] = token
    session['security_gate'] = {'stage': stage, 'action': action, 'method': method, 'token': token}


def require_gate(row, user, action=None, method=None, stage='verified'):
    gate = session.get('security_gate', {})
    token, item = challenge('reauth', user['user_id'])
    validate_challenge(row, item)
    overview = gate.get('action') == 'overview' and stage == 'verified' and action in (None, 'overview', 'setup', 'primary', 'disable')
    if (gate.get('stage') != stage or gate.get('token') != token
            or (not overview and action is not None and gate.get('action') != action)
            or (not overview and method is not None and gate.get('method') != method)):
        raise SecurityError('Подтверждение истекло. Начните заново.', 401)
    return gate


@atomic
def gate(user, data):
    row = locked_security(user['user_id'])
    step = data.get('step', 'password')
    if step == 'status':
        try:
            require_gate(row, user, 'overview')
        except SecurityError:
            return {'verified': False}
        return {'verified': True}
    if step == 'cancel':
        verified = session.get('security_gate', {}).get('stage') == 'verified'
        for purpose in (('setup',) if verified else ('reauth', 'setup')):
            token = session.pop('security_' + purpose, '')
            get_db().execute('DELETE FROM security_challenges WHERE token_hash=%s AND user_id=%s', (digest(token), user['user_id']))
        if not verified:
            session.pop('security_gate', None)
        return {'cancelled': True}
    if step == 'password':
        action, method = data.get('action'), data.get('method')
        if action not in ('overview', 'setup', 'primary', 'disable', 'recovery') or method not in ('email', 'totp', ''):
            raise SecurityError('Недопустимое действие.')
        require_password(row, data.get('password', ''))
        gate_record(row, user, 'factor' if row['two_factor_enabled'] else 'verified', action, method)
        local, domain = user['email'].rsplit('@', 1)
        return {'verified': not row['two_factor_enabled'], 'primary': row['primary_2fa_method'], 'masked_email': local[:2] + '***@' + domain}
    grant = require_gate(row, user, stage='factor')
    if step == 'send':
        if row['primary_2fa_method'] != 'email' or not active_email(row, user):
            raise SecurityError('Этот способ пока недоступен.')
        token = issue(row, user, 'reauth', 'email')
        session['security_gate'] = dict(grant, token=token)
        return {'sent': True}
    if step != 'factor':
        raise SecurityError('Недопустимое действие.')
    method = 'recovery' if data.get('recovery') == '1' else row['primary_2fa_method']
    authorize_factor(row, user, {'confirmation_method': method, 'confirmation_code': data.get('code', '')})
    gate_record(row, user, 'verified', grant['action'], grant['method'])
    return {'verified': True}


@atomic
def start_login(user_id):
    row = locked_security(user_id)
    session.clear()
    if not row['two_factor_enabled']:
        return {'authenticated_user': user_id}
    check_lock(row)
    user = get_db().execute('SELECT email FROM users WHERE user_id=%s', (user_id,)).fetchone()
    method = row['primary_2fa_method']
    if method == 'email' and not active_email(row, user):
        raise SecurityError('Подтверждение недоступно. Обратитесь в поддержку.', 403)
    if method == 'email':
        # Create a pending challenge first so recovery remains usable if SMTP fails.
        token = secrets.token_urlsafe(32)
        get_db().execute("DELETE FROM security_challenges WHERE user_id=%s AND purpose='login'", (user_id,))
        get_db().execute('''INSERT INTO security_challenges
            (token_hash,user_id,purpose,method,email,revision,expires_at)
            VALUES (%s,%s,'login','email',%s,%s,%s)''',
            (digest(token), user_id, user['email'], row['revision'], now() + timedelta(minutes=5)))
        session['security_login'] = token
    try:
        issue(row, user, 'login', method)
        sent = True
    except SecurityError as error:
        if method != 'email' or error.status not in (429, 503):
            raise
        sent = False
    local, domain = user['email'].rsplit('@', 1)
    return {'requires_2fa': True, 'method': method, 'email_sent': sent,
            'masked_email': local[:2] + '***@' + domain, 'resend_after': 60 if sent and method == 'email' else 0}


@atomic
def verify_login(data):
    token, item = challenge('login')
    row = locked_security(item['user_id'])
    # Reload after obtaining the account lock to prevent concurrent consumption.
    token, item = challenge('login')
    if not row['two_factor_enabled']:
        raise SecurityError('Подтверждение истекло. Начните заново.', 401)
    verify(row, item, token, data.get('code', ''), data.get('recovery') == '1')
    session.pop('security_login', None)
    return {'authenticated_user': row['user_id']}


@atomic
def resend_login():
    _, item = challenge('login')
    row = locked_security(item['user_id'])
    _, item = challenge('login')
    validate_challenge(row, item)
    if item['method'] != 'email':
        raise SecurityError('Этот способ пока недоступен.')
    user = get_db().execute('SELECT email FROM users WHERE user_id=%s', (row['user_id'],)).fetchone()
    issue(row, user, 'login', 'email')
    return {'sent': True}


@atomic
def settings_state(user):
    row = locked_security(user['user_id'])
    require_gate(row, user, 'overview')
    state = public_state(row)
    local, domain = user['email'].rsplit('@', 1)
    state['masked_email'] = local[:2] + '***@' + domain
    return state


@atomic
def send_confirmation(user, data):
    row = locked_security(user['user_id'])
    require_password(row, data.get('password', ''))
    if not active_email(row, user):
        raise SecurityError('Этот способ пока недоступен.')
    issue(row, user, 'reauth', 'email')
    return {'sent': True}


@atomic
def setup(user, data):
    row = locked_security(user['user_id'])
    method = data.get('method')
    if method not in ('email', 'totp'):
        raise SecurityError('Этот способ пока недоступен.')
    gated = data.get('use_gate') == '1'
    if not gated and ((method == 'email' and active_email(row, user)) or (method == 'totp' and row['totp_secret'])):
        raise SecurityError('Этот способ уже подключён.')
    try:
        if gated:
            require_gate(row, user, 'setup', method)
        else:
            authorize_change(row, user, data)
    except SecurityError as error:
        error.field = error.field or 'confirmation_code'
        raise
    secret = pyotp.random_base32() if method == 'totp' else None
    issue(row, user, 'setup', method, secret)
    result = {'method': method}
    if secret:
        uri = pyotp.TOTP(secret).provisioning_uri(name=user['email'], issuer_name='Sonary')
        output = io.BytesIO()
        qrcode.make(uri).save(output, format='PNG')
        result.update(secret=secret, qr='data:image/png;base64,' + base64.b64encode(output.getvalue()).decode())
    return result


@atomic
def resend_setup(user, data=None):
    row = locked_security(user['user_id'])
    if data and data.get('use_gate') == '1':
        require_gate(row, user, 'setup', 'email')
    _, item = challenge('setup', user['user_id'])
    validate_challenge(row, item)
    if item['method'] != 'email':
        raise SecurityError('Этот способ пока недоступен.')
    issue(row, user, 'setup', 'email')
    return {'sent': True}


@atomic
def confirm_setup(user, data):
    row = locked_security(user['user_id'])
    token, item = challenge('setup', user['user_id'])
    if data.get('use_gate') == '1':
        require_gate(row, user, 'setup', item['method'])
    else:
        require_password(row, data.get('password', ''))
    verify(row, item, token, data.get('code', ''))
    db = get_db()
    if item['method'] == 'email':
        db.execute('UPDATE user_security SET email_enabled=true, verified_email=%s WHERE user_id=%s',
                   (user['email'], user['user_id']))
    else:
        db.execute('UPDATE user_security SET totp_secret=%s WHERE user_id=%s', (item['pending_secret'], user['user_id']))
    db.execute('UPDATE user_security SET two_factor_enabled=true, primary_2fa_method=%s WHERE user_id=%s',
               (row['primary_2fa_method'] or item['method'], user['user_id']))
    codes = recovery_codes(user['user_id']) if not row['two_factor_enabled'] else None
    bump(row, user if data.get('use_gate') == '1' else None)
    session.pop('security_setup', None)
    return {'state': public_state(locked_security(user['user_id'])), 'recovery_codes': codes}


@atomic
def manage(user, data):
    row = locked_security(user['user_id'])
    action = data.get('action')
    if not row['two_factor_enabled'] or action not in ('primary', 'disable', 'recovery'):
        raise SecurityError('Недопустимое действие.')
    gated = data.get('use_gate') == '1'
    if action == 'primary' or (gated and action == 'disable'):
        method = data.get('method')
        if not ((method == 'email' and active_email(row, user)) or (method == 'totp' and row['totp_secret'])):
            raise SecurityError('Этот способ пока недоступен.')
    try:
        if gated:
            require_gate(row, user, action, data.get('method', ''))
        else:
            authorize_change(row, user, data)
    except SecurityError as error:
        error.field = error.field or 'confirmation_code'
        raise
    db = get_db()
    codes = None
    if action == 'disable' and gated:
        method = data['method']
        remaining = 'email' if method == 'totp' and active_email(row, user) else 'totp' if method == 'email' and row['totp_secret'] else None
        if method == 'email':
            db.execute('UPDATE user_security SET email_enabled=false,verified_email=NULL WHERE user_id=%s', (user['user_id'],))
        else:
            db.execute('UPDATE user_security SET totp_secret=NULL,last_totp_step=-1 WHERE user_id=%s', (user['user_id'],))
        primary = remaining if row['primary_2fa_method'] == method else row['primary_2fa_method']
        db.execute('UPDATE user_security SET two_factor_enabled=%s,primary_2fa_method=%s WHERE user_id=%s',
                   (bool(remaining), primary if remaining else None, user['user_id']))
        if not remaining:
            db.execute('DELETE FROM security_recovery_codes WHERE user_id=%s', (user['user_id'],))
    elif action == 'disable':
        db.execute('''UPDATE user_security SET two_factor_enabled=false,primary_2fa_method=NULL,
            email_enabled=false,verified_email=NULL,totp_secret=NULL,last_totp_step=-1 WHERE user_id=%s''', (user['user_id'],))
        db.execute('DELETE FROM security_recovery_codes WHERE user_id=%s', (user['user_id'],))
    elif action == 'primary':
        db.execute('UPDATE user_security SET primary_2fa_method=%s WHERE user_id=%s', (data['method'], user['user_id']))
    else:
        codes = recovery_codes(user['user_id'])
    bump(row, user if gated else None)
    return {'state': public_state(locked_security(user['user_id'])), 'recovery_codes': codes}
