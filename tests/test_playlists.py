import io
from datetime import date, timedelta
from pathlib import Path
import pytest
from test_auth import setup, post
from test_diary import diary_setup, send, create as track, row, other_client
from diary_fixtures import png_bytes
from playlists import queries

@pytest.fixture
def playlist_setup(diary_setup):
    app, client, db, name, folder = diary_setup
    app.config['PLAYLIST_COVER_FOLDER'] = str(folder/'playlists')
    return app, client, db, name, folder

def create(client, **changes):
    data = dict(playlistTitle='QA playlist', playlistDescription='A real collection', privacy='private')
    data.update(changes)
    result = send(client, '/playlists', data)
    assert result.status_code == 303, result.get_data(as_text=True)
    return int(result.headers['Location'].rsplit('/',1)[1])

def saved(db,id):
    return db.execute('SELECT * FROM playlists WHERE playlist_id=%s',(id,)).fetchone()

def links(db,id):
    return db.execute('SELECT track_id FROM playlist_tracks WHERE playlist_id=%s ORDER BY track_id',(id,)).fetchall()

def test_guest_and_csrf(setup):
    app,client,db = setup
    assert send(client,'/playlists',{'playlistTitle':'No'}).status_code == 302
    assert client.post('/playlists',data={'playlistTitle':'No'}).status_code == 400

def test_crud_persistence_profile(playlist_setup):
    app,client,db,name,folder = playlist_setup
    id=create(client)
    with client.session_transaction() as state:
        assert saved(db,id)['user_id']==state['user_id']
    assert 'QA playlist' in client.get('/playlists').get_data(as_text=True)
    assert 'QA playlist' in client.get('/profile').get_data(as_text=True)
    assert client.get('/settings/profile').json['profile']['playlist_count']==1
    post(client,'logout',{}); post(client,'login',{'identity':name,'password':'Test-pass-938!'})
    assert client.get(f'/playlist/{id}').status_code==200
    assert send(client,f'/playlist/{id}/edit',{'playlistTitle':'Edited','privacy':'public'}).status_code==303
    assert saved(db,id)['title']=='Edited' and saved(db,id)['privacy']=='public'
    assert send(client,f'/playlist/{id}/delete',{}).status_code==303
    assert saved(db,id) is None

@pytest.mark.parametrize('data,field',[
    ({'playlistTitle':''},'playlistTitle'),({'playlistTitle':'x'*256},'playlistTitle'),
    ({'playlistDescription':'word '*51},'playlistDescription'),({'privacy':'followers'},'privacy'),
    ({'user_id':'1'},'form'),({'cover_filename':'../../secret'},'form'),
    ({'track_ids':['-1']},'form'),({'track_ids':['bad']},'form')])
def test_validation(playlist_setup,data,field):
    app,client,db,name,folder=playlist_setup
    values={'playlistTitle':'QA'}; values.update(data)
    response=send(client,'/playlists',values)
    assert response.status_code==400 and field in response.json['errors']
    assert db.execute('SELECT count(*) AS n FROM playlists').fetchone()['n']==0

def test_ownership_private_public_media(playlist_setup):
    app,client,db,name,folder=playlist_setup
    id=create(client,playlistCover=(io.BytesIO(png_bytes()),'../../cover.jpg'))
    other=other_client(app)
    for url in [f'/playlist/{id}',f'/media/playlists/{id}/cover']:
        assert other.get(url).status_code==404
    for url,data in [(f'/playlist/{id}/edit',{'playlistTitle':'Stolen'}),
                     (f'/playlist/{id}/delete',{}),(f'/playlists/delete',{'playlist_ids':[str(id)]}),
                     (f'/playlist/{id}/tracks/add',{'track_ids':['999999']}),
                     (f'/playlist/{id}/tracks/remove',{'track_ids':['999999']})]:
        assert send(other,url,data).status_code==404
    assert saved(db,id)['title']=='QA playlist'
    assert send(client,f'/playlist/{id}/edit',{'privacy':'public'}).status_code==303
    assert other.get(f'/playlist/{id}').status_code==200
    assert other.get(f'/media/playlists/{id}/cover').status_code==200
    assert b'data-playlist-add' not in other.get(f'/playlist/{id}').data

def test_add_remove_duplicates_delete_preserves_tracks(playlist_setup):
    app,client,db,name,folder=playlist_setup
    a=track(client,cover=(io.BytesIO(png_bytes()),'cover.png'));b=track(client)
    old=row(db,a);id=create(client)
    assert send(client,f'/playlist/{id}/tracks/add',{'track_ids':[str(a),str(b)]}).status_code==303
    assert send(client,f'/playlist/{id}/tracks/add',{'track_ids':[str(a),str(a)]}).status_code==303
    assert len(links(db,id))==2
    assert send(client,f'/playlist/{id}/tracks/remove',{'track_ids':[str(a)]}).status_code==303
    assert len(links(db,id))==1 and row(db,a)==old
    second=create(client,track_ids=[str(a),str(b)])
    assert send(client,f'/playlist/{id}/delete',{}).status_code==303
    assert not links(db,id) and len(links(db,second))==2
    assert row(db,a) and row(db,b)
    assert (folder/'audio'/old['audio_filename']).exists() and (folder/'covers'/old['cover_filename']).exists()

def test_public_playlist_hides_private_tracks(playlist_setup):
    app,client,db,name,folder=playlist_setup
    a=track(client,title='Secret track');b=track(client,title='Public track',privacy='public')
    id=create(client,privacy='public',track_ids=[str(a),str(b)])
    other=other_client(app)
    html=other.get(f'/playlist/{id}').get_data(as_text=True)
    assert 'Secret track' not in html and 'Public track' in html
    assert other.get(f'/media/tracks/{a}/audio').status_code==404
    assert send(other,f'/playlists/add-track',{'playlist_ids':[str(id)],'track_id':str(b)}).status_code==404
    foreign=create(other)
    assert send(other,f'/playlist/{foreign}/tracks/add',{'track_ids':[str(a),str(b)]}).status_code==400
    assert not links(db,foreign)
    assert send(other,f'/playlist/{foreign}/tracks/add',{'track_ids':[str(b)]}).status_code==400
    own=track(other,title='Other owner track')
    assert send(other,f'/playlist/{foreign}/tracks/add',{'track_ids':[str(own)]}).status_code==303
    picker=other.get(f'/playlist/{foreign}').get_data(as_text=True)
    assert f'class="playlist-track-checkbox" type="checkbox" value="{own}"' in picker
    assert f'class="playlist-track-checkbox" type="checkbox" value="{b}"' not in picker
    send(client,f'/track/{b}/edit',{'privacy':'private'})
    assert 'Public track' not in other.get(f'/playlist/{id}').get_data(as_text=True)

def test_add_from_track_menu_atomic_and_csrf(playlist_setup):
    app,client,db,name,folder=playlist_setup
    a=track(client);p=create(client);q=create(client)
    assert send(client,'/playlists/add-track',{'playlist_ids':[str(p),str(q)],'track_id':str(a)}).status_code==303
    assert len(links(db,p))==len(links(db,q))==1
    other=other_client(app);foreign=create(other)
    assert send(client,'/playlists/add-track',{'playlist_ids':[str(p),str(foreign)],'track_id':str(a)}).status_code==404
    assert not links(db,foreign)
    for url,data in [(f'/playlist/{p}/edit',{'playlistTitle':'no'}),(f'/playlist/{p}/delete',{}),
                     (f'/playlist/{p}/tracks/add',{'track_ids':[str(a)]}),
                     (f'/playlist/{p}/tracks/remove',{'track_ids':[str(a)]}),
                     ('/playlists/add-track',{'playlist_ids':[str(p)],'track_id':str(a)}),
                     ('/playlists/delete',{'playlist_ids':[str(p)]})]:
        assert client.post(url,data=data).status_code==400
        assert client.get(url).status_code==405

def test_cover_validation_cleanup_db_failure(playlist_setup,monkeypatch):
    app,client,db,name,folder=playlist_setup
    result=send(client,'/playlists',{'playlistTitle':'Bad','playlistCover':(io.BytesIO(b'bad'),'cover.png')})
    assert result.status_code==400 and 'playlistCover' in result.json['errors']
    id=create(client,playlistCover=(io.BytesIO(png_bytes()),'cover.png'))
    old=saved(db,id)['cover_filename']
    assert send(client,f'/playlist/{id}/edit',{'playlistCover':(io.BytesIO(png_bytes('blue')),'new.png')}).status_code==303
    assert not (folder/'playlists'/old).exists()
    new=saved(db,id)['cover_filename']
    def fail(*args): raise RuntimeError('database-test-failure')
    monkeypatch.setattr(queries,'update',fail)
    assert send(client,f'/playlist/{id}/edit',{'playlistCover':(io.BytesIO(png_bytes()),'new.png')}).status_code==500
    assert saved(db,id)['cover_filename']==new
    assert [p.name for p in (folder/'playlists').iterdir()]==[new]
    assert send(client,f'/playlist/{id}/delete',{}).status_code==303
    assert not list((folder/'playlists').iterdir())

def test_filters_and_track_cascade(playlist_setup):
    app,client,db,name,folder=playlist_setup
    a=track(client,trackMood='calm');id=create(client,track_ids=[str(a)])
    assert 'QA playlist' in client.get('/playlists?mood=calm').get_data(as_text=True)
                                                                                     
    html=client.get('/playlists?mood=sad').get_data(as_text=True).split('id="playlistsGrid"')[1].split('</section>')[0]
    assert 'data-playlist-id' not in html
    html=client.get('/playlists?date_from='+(date.today()+timedelta(days=1)).isoformat()).get_data(as_text=True).split('id="playlistsGrid"')[1].split('</section>')[0]
    assert 'data-playlist-id' not in html
    assert client.get('/playlists?date_from=bad').status_code==200
    assert send(client,f'/track/{a}/delete',{}).status_code==303
    assert not links(db,id) and saved(db,id)

def test_create_cover_db_failure_and_limits(playlist_setup,monkeypatch):
    app,client,db,name,folder=playlist_setup
    def fail(*args): raise RuntimeError('playlist-insert-failure')
    monkeypatch.setattr(queries,'insert',fail)
    assert send(client,'/playlists',{'playlistTitle':'QA','playlistCover':(io.BytesIO(png_bytes()),'cover.png')}).status_code==500
    assert not list((folder/'playlists').glob('*'))
    app.config['TRACK_COVER_MAX_BYTES']=10
    response=send(client,'/playlists',{'playlistTitle':'QA','playlistCover':(io.BytesIO(png_bytes()),'cover.png')})
    assert response.status_code==400 and 'playlistCover' in response.json['errors']
    assert db.execute('SELECT count(*) AS n FROM playlists').fetchone()['n']==0

def test_unavailable_track_and_unknown_playlist(playlist_setup):
    app,client,db,name,folder=playlist_setup
    p=create(client)
    assert send(client,f'/playlist/{p}/tracks/add',{'track_ids':['2147483647']}).status_code==400
    assert not links(db,p)
    assert client.get('/playlist/2147483647').status_code==404
    assert send(client,'/playlist/2147483647/edit',{'playlistTitle':'No'}).status_code==404

def test_diary_action_row_separate_from_tracks(playlist_setup):
    app,client,db,name,folder=playlist_setup
    for url in ['/diary','/diary?mood=sad&sort=best']:
        html=client.get(url).get_data(as_text=True)
        action=html.split('class="diary-action-row"')[1].split('</section>')[0]
        assert 'data-create-track-card' in action and 'data-delete-track-action' in action
        assert 'data-track-id' not in action and 'class="track-card' not in action
        assert 'data-delete-track-action disabled' in action
    track(client);track(client)
    html=client.get('/diary?sort=short').get_data(as_text=True)
    assert html.index('diary-action-row')<html.index('id="diaryTrackList"')
    action=html.split('class="diary-action-row"')[1].split('</section>')[0]
    assert 'data-delete-track-action disabled' not in action


def test_playback_and_create_from_track(playlist_setup):
    app, client, db, name, folder = playlist_setup
    a = track(client)
    b = track(client)
    p = create(client, track_ids=[str(a), str(a), str(b)])
    data = client.get(f'/playlist/{p}/playback').json
    assert [item['id'] for item in data] == [a, b]
    assert len(links(db, p)) == 2
    metadata = client.get(f'/track/{a}/playback').json
    assert set(metadata) == {'id', 'title', 'artist', 'cover', 'audio_url', 'duration_seconds', 'normalization_gain_db'}
    assert client.get(metadata['audio_url']).status_code == 200
    other = other_client(app)
    assert other.get(f'/track/{a}/playback').status_code == 404
    assert other.get(f'/playlist/{p}/playback').status_code == 404
    assert send(client, f'/playlist/{p}/tracks/add', {'track_ids':[str(a)]}).status_code == 303
    assert len(links(db, p)) == 2
    empty = create(client)
    assert client.get(f'/playlist/{empty}/playback').json == []
    shell = client.get('/profile', headers={'Sec-Fetch-Dest':'document'})
    assert shell.status_code == 200 and b'id="sonaryPage"' in shell.data
    frame = client.get('/profile', headers={'Sec-Fetch-Dest':'iframe'})
    assert frame.status_code == 200 and b'id="sonaryPage"' not in frame.data
