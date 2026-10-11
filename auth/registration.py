import hmac
import secrets
from datetime import timedelta
from flask import request, session
from psycopg.errors import UniqueViolation
from auth import mail, queries, services
from auth.security import atomic, digest, now, SecurityError
from database import get_db


def rate_limit(kind, value, limit):
    db = get_db()
    bucket = digest('registration-rate:' + kind + ':' + value)
    db.execute("DELETE FROM registration_rate_limits WHERE started_at < now() - interval '1 hour'")
    row = db.execute('''INSERT INTO registration_rate_limits(bucket,started_at,attempts)
        VALUES (%s,now(),1) ON CONFLICT(bucket) DO UPDATE SET
        attempts=CASE WHEN registration_rate_limits.started_at < now()-interval '15 minutes' THEN 1 ELSE registration_rate_limits.attempts+1 END,
        started_at=CASE WHEN registration_rate_limits.started_at < now()-interval '15 minutes' THEN now() ELSE registration_rate_limits.started_at END
        RETURNING attempts''', (bucket,)).fetchone()
    if row['attempts'] > limit:
        raise SecurityError('Слишком много запросов. Попробуйте через 15 минут.', 429)


def pending():
    token = session.get('pending_registration', '')
    row = get_db().execute('SELECT * FROM pending_registrations WHERE token_hash=%s FOR UPDATE',
                           (digest('registration:' + token),)).fetchone()
    if not row or row['expires_at'] <= now():
        raise SecurityError('Регистрация истекла. Начните заново.', 401)
    return token, row


def view(row):
    return {'pending': True, 'requires_email_verification': True, 'email': row['email'],
            'username': row['username'], 'email_sent': bool(row['code_hash'] and row['code_expires_at'] > now()),
            'resend_after': max(0, int((row['last_sent_at'] + timedelta(seconds=60) - now()).total_seconds()) + 1) if row['last_sent_at'] else 0}


def send(token, row):
    if row['locked_until'] and row['locked_until'] > now():
        raise SecurityError('Слишком много попыток. Попробуйте через 15 минут.', 429)
    if row['last_sent_at'] and row['last_sent_at'] > now() - timedelta(seconds=60):
        error = SecurityError('Повторная отправка доступна через 60 секунд.', 429)
        error.retry_after = max(1, int((row['last_sent_at'] + timedelta(seconds=60) - now()).total_seconds()) + 1)
        raise error
    rate_limit('email', row['email'], 5)
    code = f'{secrets.randbelow(1000000):06d}'
    try:
        mail.send_otp(row['email'], code)
    except mail.MailUnavailable:
        raise SecurityError('Не удалось отправить письмо. Попробуйте позже.', 503) from None
    get_db().execute('''UPDATE pending_registrations SET code_hash=%s,code_expires_at=%s,last_sent_at=%s,
        attempts=CASE WHEN locked_until <= now() THEN 0 ELSE attempts END,
        locked_until=CASE WHEN locked_until <= now() THEN NULL ELSE locked_until END WHERE token_hash=%s''',
        (digest('registration-code:' + token + ':' + code), now() + timedelta(minutes=10), now(), row['token_hash']))


@atomic
def begin(data):
    if session.get('user_id'):
        raise SecurityError('Недопустимое действие.', 400)
    rate_limit('start-ip', request.remote_addr or '', 20)
    values, error, field = services.validate_registration(data)
    if error:
        raise SecurityError(error, 400, field)
    db = get_db()
    db.execute('DELETE FROM pending_registrations WHERE expires_at <= now()')
    old = session.get('pending_registration', '')
    previous = db.execute('SELECT * FROM pending_registrations WHERE token_hash=%s FOR UPDATE', (digest('registration:' + old),)).fetchone()
    if previous and previous['email'] == values['email'] and previous['username'] == values['username']:
        db.execute('UPDATE pending_registrations SET password_hash=%s WHERE token_hash=%s', (values['password_hash'], previous['token_hash']))
        return view(previous)
    rate_limit('identity', values['email'], 5)
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM pending_registrations WHERE token_hash=%s', (digest('registration:' + old),))
    row = db.execute('''INSERT INTO pending_registrations(token_hash,username,email,password_hash)
        VALUES (%s,%s,%s,%s) RETURNING *''',
        (digest('registration:' + token), values['username'], values['email'], values['password_hash'])).fetchone()
    session['pending_registration'] = token
    try:
        send(token, row)
    except SecurityError as failure:
        if failure.status not in (429, 503):
            raise
        return {**view(row), 'delivery_error': failure.message}
    return view(pending()[1])


@atomic
def status():
    if not session.get('pending_registration'):
        return {'pending': False}
    try:
        return view(pending()[1])
    except SecurityError:
        session.pop('pending_registration', None)
        return {'pending': False}


@atomic
def resend():
    rate_limit('send-ip', request.remote_addr or '', 20)
    token, row = pending()
    send(token, row)
    return view(pending()[1])


@atomic
def confirm(data):
    rate_limit('verify-ip', request.remote_addr or '', 30)
    token, row = pending()
    if row['locked_until'] and row['locked_until'] > now():
        raise SecurityError('Слишком много попыток. Попробуйте через 15 минут.', 429)
    if not row['code_hash'] or row['code_expires_at'] <= now():
        raise SecurityError('Код истёк. Запросите новый код.')
    code = data.get('code', '').strip()[:128]
    if not hmac.compare_digest(row['code_hash'], digest('registration-code:' + token + ':' + code)):
        attempts = row['attempts'] + 1
        get_db().execute('UPDATE pending_registrations SET attempts=%s,locked_until=%s WHERE token_hash=%s',
                         (attempts, now() + timedelta(minutes=15) if attempts >= 5 else None, row['token_hash']))
        raise SecurityError('Неверный или истёкший код подтверждения.')
    try:
        with get_db().transaction():
            user_id = queries.insert_user(row['username'], row['email'], row['password_hash'])
            get_db().execute('UPDATE users SET email_verified_at=now(),email_verified_address=%s WHERE user_id=%s', (row['email'], user_id))
    except UniqueViolation:
        taken = queries.registration_availability(row['username'], row['email'])
        field = 'username' if taken['username_taken'] else 'email'
        raise SecurityError('Этот логин или адрес почты уже занят.', 400, field) from None
    get_db().execute('DELETE FROM pending_registrations WHERE token_hash=%s', (row['token_hash'],))
    session.pop('pending_registration', None)
    return {'authenticated_user': user_id}
