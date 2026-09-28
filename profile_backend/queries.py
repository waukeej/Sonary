from psycopg import sql
from database import get_db

FIELDS = ('username', 'email', 'display_name', 'bio', 'city', 'avatar_filename', 'profile_visibility')


def lock_user(user_id):
    return get_db().execute('SELECT avatar_filename FROM users WHERE user_id = %s FOR UPDATE', (user_id,)).fetchone()


def update_user(user_id, fields):
    if not fields or not set(fields).issubset(FIELDS):
        raise ValueError('Invalid update fields')
    assignments = sql.SQL(', ').join(sql.SQL('{} = %s').format(sql.Identifier(key)) for key in fields)
    return get_db().execute(
        sql.SQL('UPDATE users SET {} WHERE user_id = %s RETURNING user_id').format(assignments),
        (*fields.values(), user_id),
    ).fetchone()
