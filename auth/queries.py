from database import get_db


def find_user(user_id):
    return get_db().execute('SELECT user_id, username, email, display_name, bio, city, avatar_filename, profile_visibility, created_at FROM users WHERE user_id = %s', (user_id,)).fetchone()


def find_login(identity):
    return get_db().execute(
        'SELECT user_id, password_hash FROM users WHERE lower(username) = lower(%s) OR lower(email) = lower(%s)',
        (identity, identity),
    ).fetchone()


def username_exists(identity):
    return get_db().execute(
        'SELECT 1 FROM users WHERE lower(username) = lower(%s)',
        (identity,),
    ).fetchone() is not None


def registration_availability(username, email):
    return get_db().execute(
        '''SELECT EXISTS(SELECT 1 FROM users WHERE lower(username) = lower(%s)) AS username_taken,
                  EXISTS(SELECT 1 FROM users WHERE lower(email) = lower(%s)) AS email_taken''',
        (username, email),
    ).fetchone()


def insert_user(username, email, password_hash):
    connection = get_db()
    with connection.transaction():
        return connection.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING user_id',
            (username, email, password_hash),
        ).fetchone()['user_id']
