import psycopg
from psycopg.rows import dict_row
from flask import current_app, g


def get_db():
    if 'db' not in g:
        config = current_app.config
        g.db = psycopg.connect(
            host=config['DB_HOST'], port=config['DB_PORT'],
            dbname=config['DB_NAME'], user=config['DB_USER'],
            password=config['DB_PASSWORD'], connect_timeout=5,
            autocommit=True, row_factory=dict_row,
        )
    return g.db


def close_db(error=None):
    connection = g.pop('db', None)
    if connection is not None:
        connection.close()

