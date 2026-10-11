from pathlib import Path
from datetime import timedelta
import pytest
from flask import g
from app import create_app
from auth import mail, security
from database import get_db


@pytest.fixture
def isolated(monkeypatch):
    app = create_app({'TESTING': True})
    with app.app_context():
        db = get_db()
        g.pop('db')
    db.execute('BEGIN')
    for table in ('users', 'pending_registrations', 'registration_rate_limits'):
        db.execute(f'CREATE TEMP TABLE {table} (LIKE public.{table} INCLUDING ALL) ON COMMIT DROP')
    migration = (Path(__file__).parents[1] / 'migrations/006_security.sql').read_text()
    db.execute(migration.replace('BEGIN;', '').replace('COMMIT;', '').replace('CREATE TABLE ', 'CREATE TEMP TABLE '))
    app.before_request_funcs[None].insert(0, lambda: setattr(g, 'db', db))
    app.teardown_appcontext_funcs.clear()
    sent = []
    monkeypatch.setattr(mail, 'send_otp', lambda address, code: sent.append((address, code)))
    monkeypatch.setattr('playlists.system.ensure', lambda user: None)
    try:
        yield app, app.test_client(), db, sent
    finally:
        db.execute('ROLLBACK')
        db.close()


def post(client, path, **data):
    token = client.get('/auth/csrf').json['csrf_token']
    return client.post(path, data=data, headers={'X-CSRFToken': token})


def begin(client, username='newmember'):
    return post(client, '/auth/register', username=username, email=username + '@example.test',
                password='Registration-938!', passwordConfirmation='Registration-938!')


def test_pending_confirm_resume_and_security_window(isolated):
    app, client, db, sent = isolated
    result = begin(client)
    assert result.json['requires_email_verification'] and result.json['email_sent']
    assert db.execute('SELECT count(*) AS n FROM users').fetchone()['n'] == 0
    assert post(client, '/auth/login', identity='newmember', password='Registration-938!').status_code == 401
    with client.session_transaction() as cookie:
        assert 'user_id' not in cookie
        assert sent[-1][1] not in str(dict(cookie))
    assert client.get('/auth/registration/status').json['pending']
    assert post(client, '/auth/registration/resend').status_code == 429
    other = app.test_client()
    assert post(other, '/auth/registration/confirm', code=sent[-1][1]).status_code == 401
    wrong = '000000' if sent[-1][1] != '000000' else '111111'
    assert post(client, '/auth/registration/confirm', code=wrong).status_code == 400
    result = post(client, '/auth/registration/confirm', code=sent[-1][1])
    assert result.status_code == 201 and result.json['redirect']
    user = db.execute('SELECT * FROM users').fetchone()
    assert user['email_verified_at'] and user['email_verified_address'] == user['email']
    assert post(client, '/auth/registration/confirm', code=sent[-1][1]).status_code == 401
    assert client.get('/settings/security').status_code == 401
    assert post(client, '/settings/security/gate', action='overview', method='', password='Registration-938!').json['verified']
    grant = db.execute("SELECT expires_at FROM security_challenges WHERE purpose='reauth'").fetchone()
    assert 115 < (grant['expires_at'] - security.now()).total_seconds() <= 120
    assert client.get('/settings/security').status_code == 200
    assert db.execute("SELECT expires_at FROM security_challenges WHERE purpose='reauth'").fetchone() == grant
    db.execute("UPDATE security_challenges SET expires_at=now()-interval '1 second'")
    assert client.get('/settings/security').status_code == 401
    post(client, '/auth/logout')
    assert post(client, '/auth/login', identity=user['username'], password='Registration-938!').status_code == 200


def test_delivery_failure_resend_expiry_and_attempt_limits(isolated, monkeypatch):
    app, client, db, sent = isolated
    def unavailable(*args): raise mail.MailUnavailable()
    monkeypatch.setattr(mail, 'send_otp', unavailable)
    result = begin(client)
    assert not result.json['email_sent'] and result.json['delivery_error']
    row = db.execute('SELECT * FROM pending_registrations').fetchone()
    assert row['last_sent_at'] is None and row['code_hash'] is None
    monkeypatch.setattr(mail, 'send_otp', lambda address, code: sent.append((address, code)))
    assert post(client, '/auth/registration/resend').json['email_sent']
    row = db.execute('SELECT * FROM pending_registrations').fetchone()
    assert 595 < (row['code_expires_at'] - security.now()).total_seconds() <= 600
    assert row['code_hash'] != sent[-1][1]
    db.execute("UPDATE pending_registrations SET last_sent_at=now()-interval '61 seconds'")
    old_hash = row['code_hash']
    post(client, '/auth/registration/resend')
    assert db.execute('SELECT code_hash FROM pending_registrations').fetchone()['code_hash'] != old_hash
    wrong = '000000' if sent[-1][1] != '000000' else '111111'
    for _ in range(5): assert post(client, '/auth/registration/confirm', code=wrong).status_code == 400
    assert post(client, '/auth/registration/confirm', code=sent[-1][1]).status_code == 429
    assert post(client, '/auth/registration/resend').status_code == 429


def test_registration_race_and_legacy_access(isolated):
    app, client, db, sent = isolated
    begin(client)
    pending = db.execute('SELECT * FROM pending_registrations').fetchone()
    db.execute('INSERT INTO users(username,email,password_hash) VALUES (%s,%s,%s)',
               ('NEWMEMBER', 'legacy@example.test', pending['password_hash']))
    result = post(client, '/auth/registration/confirm', code=sent[-1][1])
    assert result.status_code == 400 and result.json['field'] == 'username'
    assert db.execute('SELECT count(*) AS n FROM users').fetchone()['n'] == 1
    legacy = db.execute('SELECT * FROM users').fetchone()
    assert legacy['email_verified_at'] is None and legacy['email_verified_address'] is None
    assert post(client, '/auth/login', identity='NEWMEMBER', password='Registration-938!').json['redirect']
