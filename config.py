import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv


def load_config():
    load_dotenv(Path(__file__).with_name('.env'))
    return {
        'SECRET_KEY': os.getenv('SECRET_KEY'),
        'MAIL_HOST': os.getenv('MAIL_HOST', ''),
        'MAIL_PORT': os.getenv('MAIL_PORT', '587'),
        'MAIL_TIMEOUT': os.getenv('MAIL_TIMEOUT', '10'),
        'MAIL_USERNAME': os.getenv('MAIL_USERNAME', ''),
        'MAIL_PASSWORD': os.getenv('MAIL_PASSWORD', ''),
        'MAIL_FROM': os.getenv('MAIL_FROM', ''),
        'MAIL_USE_TLS': os.getenv('MAIL_USE_TLS', 'true').lower() == 'true',
        'MAIL_USE_SSL': os.getenv('MAIL_USE_SSL', 'false').lower() == 'true',
        **{key: os.getenv(key) for key in ('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')},
        'MAX_CONTENT_LENGTH': 90 * 1024 * 1024,
        'TRACK_AUDIO_FOLDER': str(Path(__file__).parent / 'instance' / 'tracks' / 'audio'),
        'TRACK_COVER_FOLDER': str(Path(__file__).parent / 'instance' / 'tracks' / 'covers'),
        'PLAYLIST_COVER_FOLDER': str(Path(__file__).parent / 'instance' / 'playlists' / 'covers'),
        'TRACK_AUDIO_MAX_BYTES': 80 * 1024 * 1024,
        'TRACK_COVER_MAX_BYTES': 5 * 1024 * 1024,
        'AVATAR_FOLDER': str(Path(__file__).parent / 'instance' / 'avatars'),
        'AVATAR_MAX_BYTES': 5 * 1024 * 1024,
        'PERMANENT_SESSION_LIFETIME': timedelta(days=7),
        'SESSION_COOKIE_HTTPONLY': True,
        'SESSION_COOKIE_SAMESITE': 'Lax',
        'SESSION_COOKIE_SECURE': os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true',
        'DEBUG': False,
    }
