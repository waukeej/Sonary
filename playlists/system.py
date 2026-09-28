from database import get_db

NAMES = {'liked': 'Понравившиеся', 'mood:happy': 'Радостное', 'mood:calm': 'Спокойное',
         'mood:sad': 'Грустное', 'mood:energetic': 'Энергичное'}


def ensure(user_id):
    for key, title in NAMES.items():
        get_db().execute('INSERT INTO playlists(user_id,title,privacy,system_key) VALUES (%s,%s,\'private\',%s) '
                         'ON CONFLICT (user_id,system_key) DO NOTHING', (user_id, title, key))


def sync_mood(user_id, track_id):
    ensure(user_id)
    get_db().execute("DELETE FROM playlist_tracks pt USING playlists p WHERE pt.playlist_id=p.playlist_id "
                     "AND p.user_id=%s AND p.system_key LIKE 'mood:%%' AND pt.track_id=%s", (user_id, track_id))
    get_db().execute("INSERT INTO playlist_tracks(playlist_id,track_id) SELECT p.playlist_id,t.track_id "
                     "FROM playlists p JOIN tracks t ON p.user_id=t.user_id AND p.system_key='mood:'||t.mood "
                     "WHERE t.track_id=%s AND t.user_id=%s ON CONFLICT DO NOTHING", (track_id,user_id))


def set_like(user_id, track_id, liked):
    ensure(user_id)
    if liked:
        get_db().execute('INSERT INTO track_likes(user_id,track_id) VALUES (%s,%s) ON CONFLICT DO NOTHING', (user_id,track_id))
        get_db().execute("INSERT INTO playlist_tracks(playlist_id,track_id) SELECT playlist_id,%s FROM playlists "
                         "WHERE user_id=%s AND system_key='liked' ON CONFLICT DO NOTHING", (track_id,user_id))
    else:
        get_db().execute('DELETE FROM track_likes WHERE user_id=%s AND track_id=%s', (user_id,track_id))
        get_db().execute("DELETE FROM playlist_tracks pt USING playlists p WHERE pt.playlist_id=p.playlist_id "
                         "AND p.user_id=%s AND p.system_key='liked' AND pt.track_id=%s", (user_id,track_id))
