from psycopg import sql
from database import get_db

FIELDS = ('title', 'description', 'privacy', 'cover_filename')

def find(id, lock=False):
    return get_db().execute('SELECT p.*,u.username AS author FROM playlists p JOIN users u USING(user_id) WHERE playlist_id=%s'
                            + (' FOR UPDATE OF p' if lock else ''), (id,)).fetchone()

def list_owned(user_id, filters=None):
    filters = filters or {}
    clauses, values = ['p.user_id=%s'], [user_id]
    for key, condition in [('date_from', 'p.created_at::date >= %s'), ('date_to', 'p.created_at::date <= %s')]:
        if filters.get(key):
            clauses.append(condition); values.append(filters[key])
    if filters.get('mood'):
        clauses.append("EXISTS (SELECT 1 FROM playlist_tracks pt JOIN tracks t USING(track_id) WHERE pt.playlist_id=p.playlist_id AND t.mood=%s AND (t.user_id=%s OR t.privacy='public'))")
        values.extend([filters['mood'], user_id])
    return get_db().execute('SELECT p.*,u.username AS author FROM playlists p JOIN users u USING(user_id) WHERE '
                            + ' AND '.join(clauses) + " ORDER BY CASE WHEN p.system_key='liked' THEN 0 ELSE 1 END,p.created_at DESC,p.playlist_id DESC", values).fetchall()

def count_owned(user_id):
    return get_db().execute('SELECT count(*) AS n FROM playlists WHERE user_id=%s', (user_id,)).fetchone()['n']

def tracks(id, user_id):
    return get_db().execute("SELECT t.* FROM playlist_tracks pt JOIN tracks t USING(track_id) WHERE playlist_id=%s AND (t.user_id=%s OR t.privacy='public') ORDER BY t.track_id", (id, user_id)).fetchall()

def available(user_id):
    return get_db().execute('SELECT * FROM tracks WHERE user_id=%s ORDER BY track_id DESC', (user_id,)).fetchall()

def insert(user_id, fields):
    if set(fields) - set(FIELDS):
        raise ValueError('Unsupported playlist fields')
    names = list(fields)
    statement = sql.SQL('INSERT INTO playlists (user_id,{}) VALUES (%s,{}) RETURNING playlist_id').format(
        sql.SQL(',').join(map(sql.Identifier, names)), sql.SQL(',').join(sql.Placeholder() for _ in names))
    return get_db().execute(statement, [user_id] + list(fields.values())).fetchone()['playlist_id']

def update(id, fields):
    if not fields or set(fields) - set(FIELDS):
        raise ValueError('Unsupported playlist fields')
    assignments = sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(n)) for n in fields)
    get_db().execute(sql.SQL('UPDATE playlists SET {},updated_at=CURRENT_TIMESTAMP WHERE playlist_id=%s').format(assignments), list(fields.values()) + [id])

def add(id, track_ids):
    for track_id in track_ids:
        get_db().execute('INSERT INTO playlist_tracks (playlist_id,track_id) VALUES (%s,%s) ON CONFLICT DO NOTHING', (id, track_id))

def remove(id, track_ids):
    get_db().execute('DELETE FROM playlist_tracks WHERE playlist_id=%s AND track_id=ANY(%s)', (id, track_ids))

def delete(id):
    get_db().execute('DELETE FROM playlists WHERE playlist_id=%s', (id,))
