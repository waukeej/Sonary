import io
import uuid
from datetime import date, timedelta
import pytest
from flask import g
from psycopg.errors import ForeignKeyViolation
from test_auth import setup, post
from diary_fixtures import wav_bytes, mp3_bytes, png_bytes

@pytest.fixture
def diary_setup(setup, tmp_path):
    app, client, db = setup
    app.config.update(TRACK_AUDIO_FOLDER=str(tmp_path/'audio'), TRACK_COVER_FOLDER=str(tmp_path/'covers'))
    name = 'd'+uuid.uuid4().hex[:10]
    assert post(client, 'register', dict(username=name,email=name+'@example.test',password='Test-pass-938!',passwordConfirmation='Test-pass-938!')).status_code == 201
    yield app, client, db, name, tmp_path

def send(client, url, data, json=False):
    token = client.get('/auth/csrf').json['csrf_token']
    return client.post(url, **({'json':data} if json else {'data':data}), headers={'X-CSRFToken':token,'Accept':'application/json'})

def values(**extra):
    return dict(title='Real track',artist='Real artist',shortDescription=' '.join(['word']*10),
                fullDescription='My thoughts',trackRating='8',trackMood='calm',trackDate=date.today().isoformat(),
                privacy='private',trackFile=(io.BytesIO(wav_bytes()),'../../clip.wav'), **extra)

def create(client, **changes):
    data = values()
    data.update(changes)
    result = send(client, '/tracks', data)
    assert result.status_code == 303, result.get_data(as_text=True)
    return int(result.headers['Location'].rsplit('/',1)[1])

def row(db, id):
    return db.execute('SELECT * FROM tracks WHERE track_id=%s',(id,)).fetchone()

def other_client(app):
    client = app.test_client()
    name = 'o'+uuid.uuid4().hex[:10]
    assert post(client,'register',dict(username=name,email=name+'@example.test',password='Test-pass-938!',passwordConfirmation='Test-pass-938!')).status_code == 201
    return client

def test_anonymous_and_csrf(setup):
    app, client, db = setup
    assert send(client,'/tracks',values()).status_code == 302
    assert client.post('/tracks',data=values()).status_code == 400

def test_create_persistence_detail_profile_and_calendar(diary_setup):
    app,client,db,name,folder = diary_setup
    id = create(client)
    with client.session_transaction() as state:
        assert row(db,id)['user_id'] == state['user_id']
    assert 'Real track' in client.get('/diary').get_data(as_text=True)
    html = client.get(f'/track/{id}').get_data(as_text=True)
    assert 'Real artist' in html and 'My thoughts' in html
    assert 'Real track' in client.get('/calendar').get_data(as_text=True)
    assert client.get('/settings/profile').json['profile']['track_count'] == 1
    assert 'Real track' in client.get('/profile').get_data(as_text=True)
    post(client,'logout',{})
    post(client,'login',{'identity':name,'password':'Test-pass-938!'})
    assert 'Real track' in client.get('/diary').get_data(as_text=True)
    assert client.get(f'/track/{id}').status_code == 200

def test_html_edit_preserves_draft_on_validation_error(diary_setup):
    app, client, db, name, folder = diary_setup
    id = create(client)
    token = client.get('/auth/csrf').json['csrf_token']
    response = client.post(f'/track/{id}/edit', data={
        'title': 'Unsaved draft', 'shortDescription': 'too short', 'trackTime': '12:34',
    }, headers={'X-CSRFToken': token, 'Accept': 'text/html'})
    assert response.status_code == 400
    html = response.get_data(as_text=True)
    assert 'value="Unsaved draft"' in html and 'value="12:34"' in html
    assert row(db, id)['title'] == 'Real track'

@pytest.mark.parametrize('changes,field', [({'trackRating':'11'},'trackRating'),({'trackRating':'-1'},'trackRating'),
    ({'trackRating':'2.5'},'trackRating'),({'trackMood':'invented'},'trackMood'),({'trackDate':'2026-02-30'},'trackDate'),
    ({'trackDate':(date.today()+timedelta(days=1)).isoformat()},'trackDate'),({'trackTime':'30:90'},'trackTime'),
    ({'privacy':'followers'},'privacy'),({'title':''},'title'),({'title':'x'*256},'title'),
    ({'shortDescription':'too short'},'shortDescription'),({'fullDescription':'word '*1001},'fullDescription'),
    ({'user_id':'1'},'form'),({'audio_filename':'../../secret'},'form')])
def test_validation(diary_setup, changes, field):
    app,client,db,name,folder = diary_setup
    data = values(); data.update(changes)
    response = send(client,'/tracks',data)
    assert response.status_code == 400 and field in response.json['errors']
    assert db.execute('SELECT count(*) AS n FROM tracks').fetchone()['n'] == 0
    assert not list(folder.rglob('*.*'))

def test_edit_ownership_and_preserve_files(diary_setup):
    app,client,db,name,folder = diary_setup
    id = create(client,cover=(io.BytesIO(png_bytes()),'cover.jpg'))
    old = row(db,id)
    other = other_client(app)
    assert send(other,f'/track/{id}/edit',{'title':'attack'}).status_code == 404
    assert send(other,f'/track/{id}/delete',{}).status_code == 404
    assert send(client,f'/track/{id}/edit',{'title':'Edited','shortDescription':'word '*12}).status_code == 303
    new = row(db,id)
    assert new['title'] == 'Edited' and new['audio_filename'] == old['audio_filename'] and new['cover_filename'] == old['cover_filename']
    assert send(client,f'/track/{id}/edit',{'user_id':999,'title':'attack'},json=True).status_code == 400
    assert client.post(f'/track/{id}/edit',data={'title':'no csrf'}).status_code == 400
    assert client.post(f'/track/{id}/delete').status_code == 400
    assert client.get(f'/track/{id}/delete').status_code == 405

@pytest.mark.parametrize('format', ['wav','mp3'])
def test_audio_without_metadata(diary_setup, format):
    app,client,db,name,folder = diary_setup
    content = wav_bytes() if format == 'wav' else mp3_bytes()
    id = create(client,trackFile=(io.BytesIO(content),'clip.'+format))
    saved = row(db,id)
    assert saved['duration_seconds'] > 0
    assert (folder/'audio'/saved['audio_filename']).read_bytes() == content
    response = client.get(f'/media/tracks/{id}/audio',headers={'Range':'bytes=0-9'})
    assert response.status_code == 206 and response.data == content[:10]

def test_metadata_fallback_and_user_priority(diary_setup):
    app,client,db,name,folder = diary_setup
    id = create(client,title='',artist='',trackFile=(io.BytesIO(mp3_bytes(True)),'tags.mp3'))
    assert row(db,id)['title'] == 'Metadata title' and row(db,id)['artist'] == 'Metadata artist'
    assert row(db,id)['cover_filename']
    id = create(client,title='User title',artist='User artist',cover=(io.BytesIO(png_bytes('red')),'user.png'),trackFile=(io.BytesIO(mp3_bytes(True)),'tags.mp3'))
    assert row(db,id)['title'] == 'User title' and row(db,id)['artist'] == 'User artist'
    from PIL import Image
    with Image.open(folder/'covers'/row(db,id)['cover_filename']) as cover:
        assert cover.getpixel((0,0)) == (255,0,0)

@pytest.mark.parametrize('content,name', [(b'not audio','fake.mp3'),(b'<script/>','fake.wav'),(wav_bytes(),'fake.exe'),(wav_bytes()[:30],'truncated.wav')], ids=['fake-mp3','fake-wav','bad-extension','truncated-wav'])
def test_bad_audio(diary_setup,content,name):
    app,client,db,username,folder = diary_setup
    response = send(client,'/tracks',dict(values(),trackFile=(io.BytesIO(content),name)))
    assert response.status_code == 400 and 'trackFile' in response.json['errors']
    assert not list(folder.rglob('*.*'))

def test_upload_limits_and_bad_cover(diary_setup):
    app,client,db,name,folder = diary_setup
    app.config['TRACK_AUDIO_MAX_BYTES'] = 10
    assert 'trackFile' in send(client,'/tracks',values()).json['errors']
    app.config['TRACK_AUDIO_MAX_BYTES'] = 80*1024*1024
    assert 'cover' in send(client,'/tracks',dict(values(),cover=(io.BytesIO(b'<svg/>'),'fake.png'))).json['errors']
    app.config['TRACK_COVER_MAX_BYTES'] = 10
    assert 'cover' in send(client,'/tracks',dict(values(),cover=(io.BytesIO(png_bytes()),'cover.png'))).json['errors']
    app.config['MAX_CONTENT_LENGTH'] = 10
    assert send(client,'/tracks',values()).status_code == 413

def test_filesystem_consistency(diary_setup,monkeypatch):
    app,client,db,name,folder = diary_setup
    from diary import queries
    original_insert = queries.insert
    def fail(*args): raise RuntimeError('test-track-db-failure')
    monkeypatch.setattr(queries,'insert',fail)
    response = send(client,'/tracks',dict(values(),cover=(io.BytesIO(png_bytes()),'cover.png')))
    assert response.status_code == 500 and not list(folder.rglob('*.*'))
    monkeypatch.setattr(queries,'insert',original_insert)
    id = create(client,cover=(io.BytesIO(png_bytes()),'cover.png'))
    old = row(db,id); old_files = set(folder.rglob('*.*'))
    original_update = queries.update
    monkeypatch.setattr(queries,'update',fail)
    assert send(client,f'/track/{id}/edit',dict(title='New',trackFile=(io.BytesIO(mp3_bytes()),'next.mp3'),cover=(io.BytesIO(png_bytes('blue')),'next.png'))).status_code == 500
    assert row(db,id) == old and set(folder.rglob('*.*')) == old_files
    monkeypatch.setattr(queries,'update',original_update)
    assert send(client,f'/track/{id}/edit',dict(trackFile=(io.BytesIO(mp3_bytes()),'next.mp3'),cover=(io.BytesIO(png_bytes('blue')),'next.png'))).status_code == 303
    assert not any(file.exists() for file in old_files)
    assert send(client,f'/track/{id}/delete',{}).status_code == 303
    assert not row(db,id) and not list(folder.rglob('*.*'))

def test_private_media_and_public_read(diary_setup):
    app,client,db,name,folder = diary_setup
    id = create(client,cover=(io.BytesIO(png_bytes()),'cover.png'))
    other = other_client(app)
    for url in [f'/track/{id}',f'/media/tracks/{id}/audio',f'/media/tracks/{id}/cover']:
        assert client.get(url).status_code == 200
        assert other.get(url).status_code == 404
    assert send(client,f'/track/{id}/edit',{'privacy':'public'}).status_code == 303
    for url in [f'/track/{id}',f'/media/tracks/{id}/audio',f'/media/tracks/{id}/cover']:
        assert other.get(url).status_code == 200
    assert 'reviewEditForm' not in other.get(f'/track/{id}').get_data(as_text=True)
    assert other.get('/diary').data.count(b'data-track-id=') == 0
    assert client.get('/media/tracks/'+str(id)+'/../../config.py').status_code == 404

def test_filters_sorting_xss_and_old_row(diary_setup):
    app,client,db,name,folder = diary_setup
    first = create(client,title='<script>danger</script>',trackMood='happy',trackRating='10')
    second = create(client,title='Other',trackMood='sad',trackRating='1',trackDate=(date.today()-timedelta(days=1)).isoformat())
    assert b'&lt;script&gt;danger&lt;/script&gt;' in client.get('/diary').data
    assert b'<script>danger</script>' not in client.get('/calendar').data
    html = client.get('/diary?sort=best').get_data(as_text=True)
    assert html.index(f'data-track-id="{first}"') < html.index(f'data-track-id="{second}"')
    html = client.get('/diary?mood=happy').get_data(as_text=True)
    assert f'data-track-id="{first}"' in html and f'data-track-id="{second}"' not in html
    assert f'data-track-id="{second}"' not in client.get('/diary?date_from='+date.today().isoformat()).get_data(as_text=True)
    assert client.get('/diary?sort=DROP%20TABLE%20tracks').status_code == 200
    with client.session_transaction() as state: owner = state['user_id']
    legacy = db.execute('INSERT INTO tracks(user_id,title) VALUES (%s,%s) RETURNING track_id',(owner,'Legacy')).fetchone()['track_id']
    assert client.get(f'/track/{legacy}').status_code == 200
    assert client.get(f'/media/tracks/{legacy}/audio').status_code == 404

def test_bulk_delete_atomic_and_future_fk_guard(diary_setup,monkeypatch):
    app,client,db,name,folder = diary_setup
    mine = create(client)
    other = other_client(app)
    theirs = create(other)
    assert send(client,'/tracks/delete',{'track_ids':[str(mine),str(theirs)]}).status_code == 404
    assert row(db,mine) and row(db,theirs)
    from diary import queries
    def linked(*args): raise ForeignKeyViolation('simulated incoming FK')
    monkeypatch.setattr(queries,'delete',linked)
    response = send(client,f'/track/{mine}/delete',{})
    assert response.status_code == 400 and row(db,mine)
    assert (folder/'audio'/row(db,mine)['audio_filename']).exists()
