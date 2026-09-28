import io
import re
from datetime import date
from test_auth import setup
from test_diary import diary_setup, create as track, send, other_client, row
from test_playlists import playlist_setup, create, links, saved
from diary_fixtures import png_bytes


def test_system_likes_moods_and_cleanup(playlist_setup):
    app, client, db, name, folder = playlist_setup
    a = track(client, cover=(io.BytesIO(png_bytes()), 'cover.png'))
    owner = row(db, a)['user_id']
    systems = {p['system_key']: p['playlist_id'] for p in db.execute('SELECT * FROM playlists WHERE user_id=%s', (owner,))}
    assert len(systems) == 5
    for _ in range(2):
        assert send(client, f'/track/{a}/like', {'liked': True}, json=True).status_code == 200
    assert client.get('/tracks/likes').json['ids'] == [a]
    assert len(links(db, systems['liked'])) == 1
    assert len(client.get(f"/playlist/{systems['liked']}/playback").json) == 1
    assert send(client, f'/track/{a}/like', {'liked': False}, json=True).status_code == 200
    assert not links(db, systems['liked'])
    assert len(links(db, systems['mood:calm'])) == 1
    assert send(client, f'/track/{a}/edit', {'trackMood': 'happy'}).status_code == 303
    assert not links(db, systems['mood:calm'])
    assert len(links(db, systems['mood:happy'])) == 1
    for id in systems.values():
        for suffix, data in [('delete', {}), ('edit', {'playlistTitle': 'No'}), ('tracks/add', {'track_ids': [str(a)]}), ('tracks/remove', {'track_ids': [str(a)]})]:
            assert send(client, f'/playlist/{id}/{suffix}', data).status_code == 403
    other = other_client(app)
    assert send(other, f'/track/{a}/like', {'liked': True}, json=True).status_code == 404
    assert other.get(f"/playlist/{systems['liked']}").status_code == 404
    assert client.post(f'/track/{a}/like', json={'liked': True}).status_code == 400
    original = row(db, a)
    p = create(client, track_ids=[str(a)], playlistCover=(io.BytesIO(png_bytes()), 'cover.png'))
    cover = folder/'playlists'/saved(db, p)['cover_filename']
    assert len(links(db, p)) == 1
    assert send(client, f'/playlist/{p}/delete', {}).status_code == 303
    assert not cover.exists()
    assert (folder/'audio'/original['audio_filename']).exists()
    assert (folder/'covers'/original['cover_filename']).exists()
    assert send(client, f'/track/{a}/like', {'liked': True}, json=True).status_code == 200
    assert send(client, f'/track/{a}/delete', {}).status_code == 303
    assert not (folder/'audio'/original['audio_filename']).exists()
    assert not (folder/'covers'/original['cover_filename']).exists()
    assert not client.get('/tracks/likes').json['ids']
    assert not links(db, systems['mood:happy'])


def test_profile_initial_five_and_combined_filter(playlist_setup):
    app, client, db, name, folder = playlist_setup
    a = track(client, title='Match', trackMood='happy')
    owner = row(db, a)['user_id']
    html = client.get('/profile').get_data(as_text=True)
    assert 'id="moreTracks"' not in html
    for i in range(6):
        db.execute('INSERT INTO tracks(user_id,title,mood,entry_date) VALUES (%s,%s,%s,%s)', (owner, f'Extra{i}', 'sad', date.today()))
    html = client.get('/profile').get_data(as_text=True)
    rows = re.findall(r'<article[^>]*class="profile-track[^>]*>', html.split('id="profileTracks"')[1].split('id="profilePlaylists"')[0])
    assert len(rows) == 7 and sum('hidden' not in r for r in rows) == 5
    html = client.get('/diary?mood=happy&date_from='+date.today().isoformat()+'&sort=best').get_data(as_text=True)
    html = html.split('</main>')[0]
    assert f'data-track-id="{a}"' in html and 'Extra0' not in html
