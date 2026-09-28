import uuid
import pytest
from flask import g, abort
from werkzeug.security import check_password_hash
from app import create_app
from database import get_db
from psycopg import sql


@pytest.fixture
def setup():
    app = create_app({'TESTING': True, 'PROPAGATE_EXCEPTIONS': False})
    with app.app_context():
        connection = get_db()
        g.pop('db')
    connection.execute('BEGIN')
                                                                                              
    for table in ('users', 'tracks'):
        connection.execute(sql.SQL('CREATE TEMP TABLE {} (LIKE public.{} INCLUDING ALL) ON COMMIT DROP').format(sql.Identifier(table), sql.Identifier(table)))
                                                                                  
    source_indexes = connection.execute("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='users'").fetchall()
    temporary_indexes = connection.execute("SELECT schemaname,indexname,indexdef FROM pg_indexes WHERE schemaname LIKE 'pg_temp_%' AND tablename='users' AND schemaname=pg_my_temp_schema()::regnamespace::text").fetchall()
    for original in source_indexes:
        for copied in temporary_indexes:
            if copied['indexdef'].split(' USING ')[-1] == original['indexdef'].split(' USING ')[-1] and copied['indexname'] != original['indexname']:
                connection.execute(sql.SQL('ALTER INDEX {}.{} RENAME TO {}').format(sql.Identifier(copied['schemaname']),sql.Identifier(copied['indexname']),sql.Identifier(original['indexname'])))
    connection.execute('CREATE TEMP TABLE playlists (LIKE public.playlists INCLUDING ALL) ON COMMIT DROP')
    connection.execute('CREATE TEMP TABLE playlist_tracks (LIKE public.playlist_tracks INCLUDING ALL) ON COMMIT DROP')
    connection.execute('CREATE TEMP TABLE track_likes (LIKE public.track_likes INCLUDING ALL) ON COMMIT DROP')
    connection.execute('ALTER TABLE track_likes ADD FOREIGN KEY (user_id) REFERENCES pg_temp.users(user_id) ON DELETE CASCADE')
    connection.execute('ALTER TABLE track_likes ADD FOREIGN KEY (track_id) REFERENCES pg_temp.tracks(track_id) ON DELETE CASCADE')
    connection.execute('ALTER TABLE playlist_tracks ADD FOREIGN KEY (playlist_id) REFERENCES pg_temp.playlists(playlist_id) ON DELETE CASCADE')
    connection.execute('ALTER TABLE playlist_tracks ADD FOREIGN KEY (track_id) REFERENCES pg_temp.tracks(track_id) ON DELETE CASCADE')
    app.before_request_funcs[None].insert(0, lambda: setattr(g, 'db', connection))
    app.teardown_appcontext_funcs.clear()
    for status in (403, 413, 500):
        app.add_url_rule('/_test/' + str(status), endpoint='error' + str(status), view_func=lambda status=status: abort(status))
    def unexpected_failure():
        raise RuntimeError('internal-test-marker')
    app.add_url_rule('/_test/unexpected', view_func=unexpected_failure)
    try:
        yield app, app.test_client(), connection
    finally:
        connection.execute('ROLLBACK')
        connection.close()


def post(client, action, data):
    token = client.get('/auth/csrf').json['csrf_token']
    return client.post('/auth/' + action, data=data, headers={'X-CSRFToken': token})


def test_auth_flow(setup):
    app, client, db = setup
    username = 't' + uuid.uuid4().hex[:10]
    email = username + '@example.test'
    values = dict(username=username, email=email, password='Test-pass-938!', passwordConfirmation='Test-pass-938!')
    assert client.get('/diary').status_code == 302
    assert client.post('/auth/register', data=values).status_code == 400
    assert post(client, 'register', values).status_code == 201
    row = db.execute('SELECT user_id,password_hash FROM users WHERE username=%s', (username,)).fetchone()
    assert row['password_hash'] != values['password']
    assert check_password_hash(row['password_hash'], values['password'])
    with client.session_transaction() as state:
        assert state['user_id'] == row['user_id']
        assert 'password' not in state
    diary_response = client.get('/diary')
    assert diary_response.status_code == 200
    assert b'id="settingsTheme"' in diary_response.data
    assert b'id="settingsLanguage"' in diary_response.data
    assert b'js/preferences.js' in diary_response.data
    assert b'css/theme-light.css' in diary_response.data
    assert client.get('/profile').status_code == 200
    assert post(client, 'logout', {}).status_code == 200
    assert client.get('/diary').status_code == 302
    assert post(client, 'login', dict(identity=username, password='wrong')).status_code == 401
    assert post(client, 'login', dict(identity=username.upper(), password=values['password'])).status_code == 200
    assert post(client, 'logout', {}).status_code == 200
    assert post(client, 'login', dict(identity=email.upper(), password=values['password'])).status_code == 200
    assert post(client, 'register', dict(values, username=username.upper(), email='other@example.test')).status_code == 400
    assert post(client, 'register', dict(values, username='z'+uuid.uuid4().hex[:10], email=email.upper())).status_code == 400
    assert post(client, 'register', dict(values, passwordConfirmation='different')).status_code == 400
    assert client.post('/auth/logout').status_code == 400
    assert client.post('/auth/logout', headers={'X-CSRFToken':'invalid'}).status_code == 400
    assert client.get('/auth/logout').status_code == 405
    assert client.get('/does-not-exist').status_code == 404
    for status in (403,413,500):
        result = client.get('/_test/' + str(status))
        assert result.status_code == status
        assert b'Traceback' not in result.data
    assert app.debug is False
    failed = client.get('/_test/unexpected')
    assert failed.status_code == 500
    assert b'internal-test-marker' not in failed.data
    assert b'Traceback' not in failed.data


def test_fake_auth_cannot_unlock(setup):
    app, client, db = setup
    assert client.get('/diary?guest=0').status_code == 302
    assert post(client, 'login', dict(identity='12345', password='12345')).status_code == 401
    assert client.get('/calendar').status_code == 302


def test_login_identity_precheck_is_only_a_hint(setup):
    app, client, db = setup
    identity = 'p' + uuid.uuid4().hex[:10]
    values = dict(username=identity, email=identity + '@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!')
    unknown = post(client, 'check-identity', {'identity': identity})
    assert unknown.status_code == 200
    assert unknown.json['exists'] is False
    assert unknown.json['field'] == 'identity'
    assert 'не найден' in unknown.json['error']
                                                                    
    assert post(client, 'check-identity', {'identity': 'unknown@example.test'}).status_code == 200
    assert post(client, 'register', values).status_code == 201
    assert post(client, 'logout', {}).status_code == 200
    found = post(client, 'check-identity', {'identity': identity.upper()})
    assert found.status_code == 200
    assert found.json['exists'] is True
    with client.session_transaction() as state:
        assert 'user_id' not in state
    assert post(client, 'login', {'identity': identity, 'password': 'wrong'}).status_code == 401
    assert post(client, 'login', {'identity': identity, 'password': values['password']}).status_code == 200


def test_landing_preferences_and_english_dictionary_are_served(setup):
    _, client, _ = setup
    landing = client.get('/')
    assert landing.status_code == 200
    assert landing.data.index(b'js/preferences.js') < landing.data.index(b'<body')
    assert b'js/auth-client.js' in landing.data
    dictionary = client.get('/static/localaise-en.json')
    assert dictionary.status_code == 200
    assert dictionary.get_json()['settings']['theme'] == 'Theme'


def test_registration_availability_and_final_unique_check(setup):
    _, client, _ = setup
    username = 'a' + uuid.uuid4().hex[:10]
    email = username + '@example.test'
    password = 'Test-pass-938!'
    values = dict(username=username, email=email, password=password, passwordConfirmation=password)
    assert client.post('/auth/check-registration', data={'username': username, 'email': email}).status_code == 400
    free = post(client, 'check-registration', values)
    assert free.status_code == 200
    assert free.json == {'username_available': True, 'email_available': True}
    assert post(client, 'check-registration', dict(values, username='!')).json['field'] == 'username'
    assert post(client, 'check-registration', dict(values, email='bad')).json['field'] == 'email'

    assert post(client, 'register', values).status_code == 201
    taken = post(client, 'check-registration', dict(values, username=username.upper(), email=email.upper()))
    assert taken.json == {'username_available': False, 'email_available': False}
    username_only = post(client, 'check-registration', dict(values, email='other@example.test'))
    assert username_only.json == {'username_available': False, 'email_available': True}
    email_only = post(client, 'check-registration', dict(values, username='x' + uuid.uuid4().hex[:10]))
    assert email_only.json == {'username_available': True, 'email_available': False}
    assert post(client, 'register', values).status_code == 400
    username_conflict = post(client, 'register', dict(values, email='another@example.test'))
    assert username_conflict.status_code == 400
    assert username_conflict.json['field'] == 'username'
    email_conflict = post(client, 'register', dict(values, username='y' + uuid.uuid4().hex[:10]))
    assert email_conflict.status_code == 400
    assert email_conflict.json['field'] == 'email'


def test_landing_actions_follow_current_user(setup):
    _, client, _ = setup
    guest = client.get('/').data
    assert b'data-go="login-name"' in guest
    assert b'data-go="register-profile"' in guest
    assert b'data-landing-logout' not in guest

    username = 'm' + uuid.uuid4().hex[:10]
    values = dict(username=username, email=username + '@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!')
    assert post(client, 'register', values).status_code == 201
    member = client.get('/?auth=login').data
    assert b'href="/diary"' in member
    assert b'data-landing-logout' in member
    assert b'data-go="login-name"' not in member
    assert b'data-go="register-profile"' not in member
    assert post(client, 'logout', {}).status_code == 200
    assert b'data-go="login-name"' in client.get('/').data

    with client.session_transaction() as state:
        state['user_id'] = -1
    assert b'data-landing-logout' not in client.get('/').data


def test_auth_cache_and_static_versions(setup):
    from pathlib import Path
    from flask import url_for
    app, client, _ = setup
    for path in ('/', '/?auth=register', '/does-not-exist', '/auth/csrf'):
        assert client.get(path).headers['Cache-Control'] == 'no-store'
    with app.test_request_context():
        for filename in ('js/landing-flow.js', 'css/theme-light.css', 'localaise-en.json'):
            version = str((Path(app.static_folder) / filename).stat().st_mtime_ns)
            assert url_for('static', filename=filename).endswith('v=' + version)
            assert url_for('static', filename=filename, v='old').endswith('v=' + version)
    markup = client.get('/').get_data(as_text=True)
    assert 'id="loginIdentityError"' in markup
    assert 'hreflang="ru"' in markup and 'hreflang="en"' in markup


def test_registration_duplicate_responses_never_redirect(setup):
    _, client, _ = setup
    username = 'r' + uuid.uuid4().hex[:10]
    values = dict(username=username, email=username+'@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!')
    assert post(client, 'register', values).status_code == 201
    post(client, 'logout', {})
    for action in ('check-registration', 'register'):
        response = post(client, action, values)
        assert response.is_json
        assert 'Location' not in response.headers
        assert response.status_code != 404
        assert response.headers['Cache-Control'] == 'no-store'
    with client.session_transaction() as state:
        assert 'user_id' not in state
