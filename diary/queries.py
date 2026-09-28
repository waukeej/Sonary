from psycopg import sql
from database import get_db

FIELDS = ('title', 'artist', 'short_description', 'full_description', 'rating', 'mood',
          'entry_date', 'entry_time', 'audio_filename', 'cover_filename', 'duration_seconds', 'privacy')
SORTS = {'': 'entry_date DESC NULLS LAST, track_id DESC',
         'best': 'rating DESC, track_id DESC', 'worst': 'rating ASC, track_id DESC',
         'long': 'duration_seconds DESC NULLS LAST, track_id DESC',
         'short': 'duration_seconds ASC NULLS LAST, track_id DESC'}

def find(track_id, lock=False):
    return get_db().execute('SELECT t.*, u.username AS author FROM tracks t JOIN users u USING (user_id) '
                            'WHERE track_id=%s' + (' FOR UPDATE OF t' if lock else ''), (track_id,)).fetchone()

def list_owned(user_id, filters=None):
    filters = filters or {}
    clauses, values = ['user_id=%s'], [user_id]
    for key, condition in [('mood', 'mood=%s'), ('date_from', 'entry_date >= %s'), ('date_to', 'entry_date <= %s')]:
        if filters.get(key):
            clauses.append(condition)
            values.append(filters[key])
    return get_db().execute('SELECT * FROM tracks WHERE ' + ' AND '.join(clauses) + ' ORDER BY ' + SORTS[filters.get('sort', '')], values).fetchall()

def count_owned(user_id):
    return get_db().execute('SELECT count(*) AS n FROM tracks WHERE user_id=%s', (user_id,)).fetchone()['n']

def insert(user_id, fields):
    names = list(fields)
    if set(names) - set(FIELDS):
        raise ValueError('Unsupported track fields')
    statement = sql.SQL('INSERT INTO tracks (user_id,{}) VALUES (%s,{}) RETURNING track_id').format(
        sql.SQL(',').join(map(sql.Identifier, names)), sql.SQL(',').join(sql.Placeholder() for _ in names))
    return get_db().execute(statement, [user_id] + [fields[n] for n in names]).fetchone()['track_id']

def update(track_id, user_id, fields):
    if not fields or set(fields) - set(FIELDS):
        raise ValueError('Unsupported track fields')
    assignments = sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(n)) for n in fields)
    return get_db().execute(sql.SQL('UPDATE tracks SET {},updated_at=CURRENT_TIMESTAMP '
                                   'WHERE track_id=%s AND user_id=%s RETURNING track_id').format(assignments),
                            list(fields.values()) + [track_id, user_id]).fetchone()

def delete(track_id, user_id):
    return get_db().execute('DELETE FROM tracks WHERE track_id=%s AND user_id=%s RETURNING track_id',
                            (track_id, user_id)).fetchone()
