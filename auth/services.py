import re
from psycopg.errors import UniqueViolation, CheckViolation
from werkzeug.security import generate_password_hash, check_password_hash
from auth import queries


def validate_registration_identity(username, email):
    if not re.fullmatch(r'[\w.-]{3,12}', username):
        return 'username', 'Логин: от 3 до 12 букв, цифр, точек, дефисов или подчёркиваний.'
    if len(email) > 255 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return 'email', 'Введите корректный адрес электронной почты.'
    return None, None


def check_registration_availability(data):
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    field, error = validate_registration_identity(username, email)
    if error:
        return None, field, error
    taken = queries.registration_availability(username, email)
    return {'username_available': not taken['username_taken'],
            'email_available': not taken['email_taken']}, None, None


def register_user(data):
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    field, error = validate_registration_identity(username, email)
    if error:
        return None, error, field
    if not 8 <= len(password) <= 128:
        return None, 'Пароль должен содержать от 8 до 128 символов.', None
    if password != data.get('passwordConfirmation'):
        return None, 'Пароли не совпадают.', None
    try:
        return queries.insert_user(username, email, generate_password_hash(password)), None, None
    except UniqueViolation as conflict:
        constraint = conflict.diag.constraint_name or ''
        if 'username' in constraint:
            return None, 'Этот логин уже занят.', 'username'
        if 'email' in constraint:
            return None, 'Эта почта уже занята.', 'email'
        return None, 'Этот логин или адрес почты уже занят.', None
    except CheckViolation:
        return None, 'Данные аккаунта не прошли проверку.', None


def authenticate(identity, password):
    if not identity or len(identity) > 255 or not password or len(password) > 128:
        return None
    user = queries.find_login(identity.strip())
    if user and check_password_hash(user['password_hash'], password):
        return user['user_id']
    return None
