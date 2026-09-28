import io
import uuid
from pathlib import Path
import pytest
from PIL import Image
from test_auth import setup, post


@pytest.fixture
def profile_setup(setup, tmp_path):
    app, client, db = setup
    app.config['AVATAR_FOLDER'] = str(tmp_path)
    username = 'p' + uuid.uuid4().hex[:10]
    assert post(client, 'register', dict(username=username, email=username+'@example.test',
        password='Test-pass-938!', passwordConfirmation='Test-pass-938!')).status_code == 201
    yield app, client, db, username, tmp_path


def save(client, data, **kwargs):
    token = client.get('/auth/csrf').json['csrf_token']
    return client.post('/settings/profile', data=data, headers={'X-CSRFToken': token}, **kwargs)


def picture(size=(80, 100)):
    output = io.BytesIO()
    Image.new('RGB', size, '#ffa044').save(output, 'PNG')
    output.seek(0)
    return output


def test_profile_requires_auth_and_csrf(setup):
    app, client, db = setup
    assert client.get('/settings/profile').status_code == 401
    assert save(client, {'bio': 'forbidden'}).status_code == 401
    assert client.post('/settings/profile', data={'bio': 'forbidden'}).status_code == 400


def test_profile_persistence(profile_setup):
    app, client, db, username, folder = profile_setup
    initial = client.get('/settings/profile').json['profile']
    assert initial['username'] == username and initial['joined_date'] != '—'
    updated = dict(display_name='Реальное имя', bio='<script>test</script>', city='Казань', profile_visibility='private')
    assert save(client, updated).status_code == 200
    assert client.get('/settings/profile').json['profile']['city'] == 'Казань'
    html = client.get('/profile').get_data(as_text=True)
    assert '&lt;script&gt;test&lt;/script&gt;' in html
    assert '<script>test</script>' not in html
    assert 'Реальное имя' in html
    assert post(client, 'logout', {}).status_code == 200
    assert post(client, 'login', {'identity': username, 'password': 'Test-pass-938!'}).status_code == 200
    actual = client.get('/settings/profile').json['profile']
    for field, value in updated.items():
        assert actual[field] == value
    assert db.execute('SELECT city FROM users WHERE user_id=%s', (initial['id'],)).fetchone()['city'] == 'Казань'


def test_identity_changes_and_unique_indexes(profile_setup):
    app, client, db, username, folder = profile_setup
    other = app.test_client()
    taken = 'x'+uuid.uuid4().hex[:10]
    post(other, 'register', dict(username=taken, email=taken+'@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!'))
    assert save(client, {'username': username.upper(), 'email': (username+'@example.test').upper()}).status_code == 200
    assert 'username' in save(client, {'username': taken.upper()}).json['errors']
    assert 'email' in save(client, {'email': (taken+'@example.test').upper()}).json['errors']
    new = 'n'+uuid.uuid4().hex[:10]
    assert save(client, {'username': new, 'email': new+'@example.test'}).status_code == 200
    assert client.get('/settings/profile').json['profile']['username'] == new
    post(client, 'logout', {})
    assert post(client, 'login', {'identity': new+'@example.test', 'password': 'Test-pass-938!'}).status_code == 200


@pytest.mark.parametrize('data,field', [({'username': 'a'}, 'username'), ({'email': 'wrong'}, 'email'),
    ({'bio': 'x'*1001}, 'bio'), ({'city': 'x'*101}, 'city'), ({'display_name': 'x'*101}, 'display_name'),
    ({'profile_visibility': 'followers'}, 'profile_visibility'), ({'role': 'admin'}, 'form'),
    ({'user_id': '1', 'bio': 'attack'}, 'form'), ({'password_hash': 'attack'}, 'form')])
def test_validation_and_mass_assignment(profile_setup, data, field):
    app, client, db, username, folder = profile_setup
    before = client.get('/settings/profile').json
    result = save(client, data)
    assert result.status_code == 400 and field in result.json['errors']
    assert client.get('/settings/profile').json == before


def test_private_ownership(profile_setup):
    app, client, db, username, folder = profile_setup
    mine = client.get('/settings/profile').json['profile']['id']
    assert save(client, {'profile_visibility': 'private', 'bio': 'private-marker'}).status_code == 200
    other = app.test_client()
    other_name = 'x'+uuid.uuid4().hex[:10]
    post(other, 'register', dict(username=other_name, email=other_name+'@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!'))
    assert other.get('/settings/profile?user_id='+str(mine)).json['profile']['username'] == other_name
    assert 'private-marker' not in other.get('/profile?user_id='+str(mine)).get_data(as_text=True)
    assert other.get('/profile/'+str(mine)).status_code == 404
    assert save(other, {'user_id': str(mine), 'bio': 'attack'}).status_code == 400
    assert client.get('/settings/profile').json['profile']['bio'] == 'private-marker'


def test_avatar_validation_replacement_and_ownership(profile_setup):
    app, client, db, username, folder = profile_setup
    result = save(client, {'avatar': (picture(), '../../outside.php')})
    assert result.status_code == 200
    url = result.json['profile']['avatar_url']
    first = folder / url.rsplit('/', 1)[1]
    assert first.exists() and first.name.endswith('.png') and len(first.stem) == 32
    assert client.get(url).status_code == 200
    assert app.test_client().get(url).status_code == 401
    other = app.test_client()
    other_name = 'z'+uuid.uuid4().hex[:10]
    post(other, 'register', dict(username=other_name, email=other_name+'@example.test', password='Test-pass-938!', passwordConfirmation='Test-pass-938!'))
    assert other.get(url).status_code == 404
    assert client.get('/settings/avatar/../../config.py').status_code == 404
    result = save(client, {'avatar': (picture(), 'replacement.png')})
    assert result.status_code == 200 and not first.exists()
    assert len(list(folder.iterdir())) == 1
    for image, filename in [(io.BytesIO(b'<svg/>'), 'fake.png'),
                            (io.BytesIO(b'x'*(5*1024*1024+1)), 'large.png'),
                            (picture((4001,4000)), 'pixels.png')]:
        result = save(client, {'avatar': (image, filename)})
        assert result.status_code == 400 and 'avatar' in result.json['errors']
        assert len(list(folder.iterdir())) == 1


def test_avatar_db_failure_removes_new_file(profile_setup, monkeypatch):
    app, client, db, username, folder = profile_setup
    assert save(client, {'avatar': (picture(), 'first.png')}).status_code == 200
    before = client.get('/settings/profile').json
    files = list(folder.iterdir())
    from profile_backend import queries
    def fail(*args):
        raise RuntimeError('simulated-profile-db-failure')
    monkeypatch.setattr(queries, 'update_user', fail)
    result = save(client, {'avatar': (picture(), 'next.png'), 'city': 'Not committed'})
    assert result.status_code == 500
    assert 'simulated-profile-db-failure' not in result.get_data(as_text=True)
    assert list(folder.iterdir()) == files
    assert client.get('/settings/profile').json == before


def test_json_spoof_and_authenticated_csrf(profile_setup):
    app, client, db, username, folder = profile_setup
    token = client.get('/auth/csrf').json['csrf_token']
    for data in [{'user_id': 1}, {'role': 'admin'}, {'password_hash': 'no'}, {'bio': []}]:
        assert client.post('/settings/profile', json=data, headers={'X-CSRFToken': token}).status_code == 400
    assert client.post('/settings/profile', data={'city': 'bad'}).status_code == 400
    assert client.get('/settings/profile').json['profile']['city'] == ''
    html = client.get('/profile').get_data(as_text=True)
    assert 'data-settings-delete-account disabled' in html
    assert '<option disabled>Только подписчикам</option>' in html
