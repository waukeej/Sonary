from pathlib import Path
import time

import pyotp
import pytest
from flask import g, jsonify
from werkzeug.security import generate_password_hash

from app import create_app
from auth import mail, security
from database import get_db
from permissions import login_required


PASSWORD = 'Security-test-938!'


@pytest.fixture
def setup(monkeypatch):
    app = create_app({'TESTING': True})
    with app.app_context():
        db = get_db()
        g.pop('db')
    db.execute('BEGIN')
    db.execute('CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL) ON COMMIT DROP')
    migration = (Path(__file__).parents[1] / 'migrations/006_security.sql').read_text()
    migration = migration.replace('BEGIN;', '').replace('COMMIT;', '').replace('CREATE TABLE ', 'CREATE TEMP TABLE ')
    db.execute(migration)
    user = db.execute('''INSERT INTO users(username,email,password_hash)
        VALUES ('secureuser','secure@example.test',%s) RETURNING user_id''',
        (generate_password_hash(PASSWORD),)).fetchone()['user_id']
    sent = []
    monkeypatch.setattr(mail, 'send_otp', lambda address, code: sent.append((address, code)))
    monkeypatch.setattr('playlists.system.ensure', lambda user_id: None)
    app.before_request_funcs[None].insert(0, lambda: setattr(g, 'db', db))
    app.teardown_appcontext_funcs.clear()
    app.add_url_rule('/security-test-protected', view_func=login_required(lambda: jsonify(ok=True)))
    try:
        yield app, app.test_client(), db, user, sent
    finally:
        db.execute('ROLLBACK')
        db.close()


def post(client, url, **data):
    if url == '/settings/security/confirm':
        data.setdefault('password', PASSWORD)
    token = client.get('/auth/csrf').json['csrf_token']
    return client.post(url, data=data, headers={'X-CSRFToken': token})


def login(client):
    return post(client, '/auth/login', identity='secureuser', password=PASSWORD)


def enable_email(client, sent):
    assert login(client).json['redirect']
    assert post(client, '/settings/security/setup', method='email', password=PASSWORD).status_code == 200
    response = post(client, '/settings/security/confirm', code=sent[-1][1])
    assert response.status_code == 200
    return response.json['recovery_codes']


def email_ready(db):
    db.execute("UPDATE user_security SET last_sent_at=now()-interval '61 seconds'")


def test_email_pending_recovery_and_reminder(setup):
    app, client, db, user, sent = setup
    assert client.get('/settings/security').status_code == 401
    assert login(client).status_code == 200
    assert post(client, '/settings/security/reminder').json == {'show': True}
    assert post(client, '/settings/security/reminder').json == {'show': False}
    assert client.post('/settings/security/setup', data={'method': 'email', 'password': PASSWORD}).status_code == 400
    assert post(client, '/settings/security/setup', method='email', password=PASSWORD).status_code == 200
    assert client.get('/settings/security').json['enabled'] is False
    response = post(client, '/settings/security/confirm', code=sent[-1][1])
    codes = response.json['recovery_codes']
    assert len(codes) == 10
    assert response.headers['Cache-Control'] == 'no-store'
    with app.app_context():
        g.db = db
        stored = db.execute('SELECT code_hash FROM security_recovery_codes').fetchall()
        assert all(row['code_hash'] not in codes for row in stored)
    post(client, '/auth/logout')
    email_ready(db)
    result = login(client)
    assert result.json['requires_2fa'] is True
    assert 'redirect' not in result.json
    with client.session_transaction() as state:
        assert 'user_id' not in state
        assert 'security_login' in state
    assert client.get('/security-test-protected').status_code == 302
    assert client.get('/settings/security').status_code == 401
    code = sent[-1][1]
    wrong = '111111' if code != '111111' else '222222'
    assert post(client, '/auth/second-factor', code=wrong).status_code == 400
    assert post(client, '/auth/second-factor', code=code).status_code == 200
    assert client.get('/security-test-protected').status_code == 200
    assert post(client, '/auth/second-factor', code=code).status_code == 401
    assert post(client, '/settings/security/reminder').json['show'] is False
    post(client, '/auth/logout')
    email_ready(db)
    login(client)
    assert post(client, '/auth/second-factor', code=codes[0], recovery='1').status_code == 200
    post(client, '/auth/logout')
    email_ready(db)
    login(client)
    assert post(client, '/auth/second-factor', code=codes[0], recovery='1').status_code == 400
    assert post(client, '/auth/second-factor', code=codes[1], recovery='1').status_code == 200


def test_totp_setup_replay_and_management(setup, monkeypatch):
    app, client, db, user, sent = setup
    login(client)
    result = post(client, '/settings/security/setup', method='totp', password=PASSWORD)
    secret = result.json['secret']
    assert result.json['qr'].startswith('data:image/png;base64,')
    with client.session_transaction() as state:
        assert secret not in str(dict(state))
    assert client.get('/settings/security').json['enabled'] is False
    instant = int(time.time())
    monkeypatch.setattr(security.time, 'time', lambda: instant)
    code = pyotp.TOTP(secret).at(instant)
    result = post(client, '/settings/security/confirm', code=code)
    codes = result.json['recovery_codes']
    assert result.json['state']['primary'] == 'totp'
    post(client, '/auth/logout')
    assert login(client).json['method'] == 'totp'
    assert post(client, '/auth/second-factor', code=code).status_code == 400
    instant += 30
    code = pyotp.TOTP(secret).at(instant)
    assert post(client, '/auth/second-factor', code=code).status_code == 200
    assert post(client, '/settings/security/manage', action='disable', password=PASSWORD).status_code != 200
    assert client.get('/settings/security').json['enabled'] is True
    result = post(client, '/settings/security/manage', action='recovery', password=PASSWORD,
                  confirmation_method='recovery', confirmation_code=codes[0])
    new_codes = result.json['recovery_codes']
    assert len(new_codes) == 10 and not set(new_codes) & set(codes)
    assert 'secret' not in client.get('/settings/security').json
    result = post(client, '/settings/security/manage', action='disable', password=PASSWORD,
                  confirmation_method='recovery', confirmation_code=new_codes[0])
    assert result.json['state']['enabled'] is False
    assert db.execute('SELECT count(*) AS n FROM security_recovery_codes').fetchone()['n'] == 0
    post(client, '/auth/logout')
    assert 'redirect' in login(client).json
    assert post(client, '/settings/security/reminder').json['show'] is True


def test_rate_limits_expiration_and_telegram(setup):
    app, client, db, user, sent = setup
    login(client)
    assert post(client, '/settings/security/setup', method='telegram', password=PASSWORD).status_code == 400
    assert post(client, '/settings/security/setup', method='email', password=PASSWORD).status_code == 200
    assert post(client, '/settings/security/resend').status_code == 429
    original = sent[-1][1]
    email_ready(db)
    assert post(client, '/settings/security/resend').status_code == 200
    assert len(sent) == 2
    db.execute("UPDATE security_challenges SET expires_at=now()-interval '1 second'")
    assert post(client, '/settings/security/confirm', code=sent[-1][1]).status_code == 401
    email_ready(db)
    assert post(client, '/settings/security/setup', method='email', password=PASSWORD).status_code == 200
    valid = sent[-1][1]
    invalid = '000000' if valid != '000000' else '999999'
    for _ in range(5):
        assert post(client, '/settings/security/confirm', code=invalid).status_code == 400
    assert post(client, '/settings/security/confirm', code=valid).status_code == 429
    assert post(client, '/settings/security/setup', method='totp', password=PASSWORD).status_code == 429
    assert client.get('/settings/security').json['enabled'] is False


def test_primary_method_persists_new_device_and_mail_failure(setup, monkeypatch):
    app, client, db, user, sent = setup
    codes = enable_email(client, sent)
    result = post(client, '/settings/security/setup', method='totp', password=PASSWORD,
                  confirmation_method='recovery', confirmation_code=codes[0])
    secret = result.json['secret']
    assert post(client, '/settings/security/confirm', code=pyotp.TOTP(secret).now()).json['state']['primary'] == 'email'
    assert post(client, '/settings/security/manage', action='primary', method='telegram', password=PASSWORD).status_code == 400
    result = post(client, '/settings/security/manage', action='primary', method='email', password=PASSWORD,
                  confirmation_method='recovery', confirmation_code=codes[1])
    assert result.json['state']['primary'] == 'email'
    def fail_delivery(*args):
        raise mail.MailUnavailable()
    monkeypatch.setattr(mail, 'send_otp', fail_delivery)
    other = app.test_client()
    email_ready(db)
    result = login(other)
    assert result.json['method'] == 'email' and result.json['email_sent'] is False
    assert other.get('/security-test-protected').status_code == 302
    assert post(other, '/auth/second-factor', code=codes[2], recovery='1').status_code == 200


def test_old_pending_invalidated_and_setup_owner(setup):
    app, client, db, user, sent = setup
    codes = enable_email(client, sent)
    other = app.test_client()
    email_ready(db)
    login(other)
    token_code = sent[-1][1]
    result = post(client, '/settings/security/manage', action='recovery', password=PASSWORD,
                  confirmation_method='recovery', confirmation_code=codes[0])
    assert result.status_code == 200
    assert post(other, '/auth/second-factor', code=token_code).status_code == 401
    assert other.get('/settings/security').status_code == 401


def test_email_reauthentication(setup):
    app, client, db, user, sent = setup
    enable_email(client, sent)
    email_ready(db)
    assert post(client, '/settings/security/confirmation-email', password=PASSWORD).status_code == 200
    code = sent[-1][1]
    assert post(client, '/settings/security/manage', action='recovery', password=PASSWORD,
                confirmation_method='email', confirmation_code=code).status_code == 200
    assert post(client, '/settings/security/manage', action='disable', password=PASSWORD,
                confirmation_method='email', confirmation_code=code).status_code == 401


def test_login_expiry_and_attempts_survive_new_challenges(setup):
    app, client, db, user, sent = setup
    enable_email(client, sent)
    post(client, '/auth/logout')
    email_ready(db)
    login(client)
    db.execute("UPDATE security_challenges SET expires_at=now()-interval '1 second'")
    assert post(client, '/auth/second-factor', code=sent[-1][1]).status_code == 401
    assert client.get('/security-test-protected').status_code == 302
    for _ in range(5):
        email_ready(db)
        assert login(client).json['requires_2fa'] is True
        wrong = '111111' if sent[-1][1] != '111111' else '222222'
        assert post(client, '/auth/second-factor', code=wrong).status_code == 400
    assert login(client).status_code == 429
    assert client.get('/security-test-protected').status_code == 302


def test_setup_bound_to_account_and_cookie_replay(setup):
    app, client, db, user, sent = setup
    login(client)
    result = post(client, '/settings/security/setup', method='totp', password=PASSWORD)
    code = pyotp.TOTP(result.json['secret']).now()
    with client.session_transaction() as state:
        original = dict(state)
    second_id = db.execute('''INSERT INTO users(username,email,password_hash)
        VALUES ('otheruser','other@example.test',%s) RETURNING user_id''',
        (generate_password_hash(PASSWORD),)).fetchone()['user_id']
    other = app.test_client()
    with other.session_transaction() as state:
        state.update(original)
        state['user_id'] = second_id
    assert post(other, '/settings/security/confirm', code=code).status_code == 401
    assert post(client, '/settings/security/confirm', code=code).status_code == 200
    with client.session_transaction() as state:
        state.update(original)
    assert post(client, '/settings/security/confirm', code=code).status_code == 401


def test_gate_first_setup_scope_expiry_and_session(setup):
    app, client, db, user, sent = setup
    login(client)
    endpoint = '/settings/security/'
    assert post(client, endpoint + 'setup', use_gate='1', method='totp').status_code == 401
    assert post(client, endpoint + 'gate', action='setup', method='totp', password='wrong').json['field'] == 'password'
    result = post(client, endpoint + 'gate', action='setup', method='totp', password=PASSWORD)
    assert result.json['verified'] is True
    assert post(client, endpoint + 'setup', use_gate='1', method='email').status_code == 401
    other = app.test_client()
    with other.session_transaction() as state:
        state['user_id'] = user
    assert post(other, endpoint + 'setup', use_gate='1', method='totp').status_code == 401
    result = post(client, endpoint + 'setup', use_gate='1', method='totp')
    code = pyotp.TOTP(result.json['secret']).now()
    with client.session_transaction() as state:
        old_session = dict(state)
        assert PASSWORD not in str(old_session)
    response = post(client, endpoint + 'confirm', use_gate='1', password='', code=code)
    assert response.json['state']['primary'] == 'totp'
    assert len(response.json['recovery_codes']) == 10
    with client.session_transaction() as state:
        state.update(old_session)
    assert post(client, endpoint + 'confirm', use_gate='1', password='', code=code).status_code == 401


def test_gate_existing_factor_method_management_and_expiration(setup):
    app, client, db, user, sent = setup
    codes = enable_email(client, sent)
    endpoint = '/settings/security/'
    result = post(client, endpoint + 'gate', action='setup', method='totp', password=PASSWORD)
    assert result.json == {'verified': False, 'primary': 'email'}
    assert post(client, endpoint + 'setup', use_gate='1', method='totp').status_code == 401
    email_ready(db)
    assert post(client, endpoint + 'gate', step='send').status_code == 200
    assert post(client, endpoint + 'gate', step='factor', code=sent[-1][1]).json['verified']
    secret = post(client, endpoint + 'setup', use_gate='1', method='totp').json['secret']
    result = post(client, endpoint + 'confirm', use_gate='1', password='', code=pyotp.TOTP(secret).now())
    assert result.json['state']['primary'] == 'email'
    assert result.json['state']['totp'] and result.json['state']['email']
    for action, method, recovery in [('primary', 'totp', codes[0]), ('disable', 'totp', codes[1]), ('disable', 'email', codes[2])]:
        assert post(client, endpoint + 'gate', action=action, method=method, password=PASSWORD).status_code == 200
        assert post(client, endpoint + 'gate', step='factor', code=recovery, recovery='1').json['verified']
        if action == 'primary':
            # A verified grant is not authorization for a different operation.
            assert post(client, endpoint + 'manage', use_gate='1', action='disable', method=method).status_code == 401
        result = post(client, endpoint + 'manage', use_gate='1', action=action, method=method)
        assert result.status_code == 200
        if action == 'primary':
            assert result.json['state']['primary'] == 'totp'
        elif method == 'totp':
            assert result.json['state']['primary'] == 'email'
            assert result.json['state']['email'] and not result.json['state']['totp']
        else:
            assert result.json['state']['enabled'] is False
    assert post(client, endpoint + 'gate', action='setup', method='email', password=PASSWORD).json['verified']
    db.execute("UPDATE security_challenges SET expires_at=now()-interval '1 second'")
    assert post(client, endpoint + 'setup', use_gate='1', method='email').status_code == 401


def test_gate_totp_reconfigure_cancel_and_recovery(setup, monkeypatch):
    app, client, db, user, sent = setup
    login(client)
    endpoint = '/settings/security/'
    secret = post(client, endpoint + 'setup', method='totp', password=PASSWORD).json['secret']
    instant = int(time.time())
    monkeypatch.setattr(security.time, 'time', lambda: instant)
    post(client, endpoint + 'confirm', code=pyotp.TOTP(secret).at(instant))
    instant += 30
    assert post(client, endpoint + 'gate', action='setup', method='totp', password=PASSWORD).json['primary'] == 'totp'
    assert post(client, endpoint + 'gate', step='factor', code=pyotp.TOTP(secret).at(instant)).json['verified']
    new_secret = post(client, endpoint + 'setup', method='totp', use_gate='1').json['secret']
    assert new_secret != secret
    assert db.execute('SELECT totp_secret FROM user_security').fetchone()['totp_secret'] == secret
    post(client, endpoint + 'gate', step='cancel')
    assert post(client, endpoint + 'confirm', use_gate='1', password='', code=pyotp.TOTP(new_secret).at(instant)).status_code == 401
    instant += 30
    post(client, endpoint + 'gate', action='recovery', method='', password=PASSWORD)
    post(client, endpoint + 'gate', step='factor', code=pyotp.TOTP(secret).at(instant))
    assert len(post(client, endpoint + 'manage', use_gate='1', action='recovery', method='').json['recovery_codes']) == 10


def test_mail_service_uses_tls_and_keeps_code_in_message_only(monkeypatch):
    events = []
    class Transport:
        def __init__(self, host, port, **options):
            events.append(('connect', host, port))
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def starttls(self, **options):
            events.append('tls')
        def login(self, username, password):
            events.append('login')
        def send_message(self, message):
            events.append(message)
    monkeypatch.setattr(mail.smtplib, 'SMTP', Transport)
    app = create_app({'TESTING': True, 'MAIL_HOST': 'smtp.example.test', 'MAIL_PORT': 587,
                      'MAIL_FROM': 'noreply@example.test', 'MAIL_USERNAME': 'fixture',
                      'MAIL_PASSWORD': 'fixture', 'MAIL_USE_TLS': True, 'MAIL_USE_SSL': False})
    with app.app_context():
        mail.send_otp('receiver@example.test', '034567')
    assert events[1:3] == ['tls', 'login']
    assert events[-1]['To'] == 'receiver@example.test'
    assert '034567' in events[-1].get_content()
