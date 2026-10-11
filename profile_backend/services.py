import io
import re
import uuid
import warnings
from pathlib import Path
from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from psycopg.errors import UniqueViolation
from auth.services import validate_registration_identity
from database import get_db
from profile_backend import queries


def avatar_path(filename):
    if not re.fullmatch(r'[0-9a-f]{32}\.png', filename or ''):
        raise ValueError('Invalid avatar filename')
    return Path(current_app.config['AVATAR_FOLDER']) / filename


def remove_avatar(filename):
    if not filename:
        return
    try:
        avatar_path(filename).unlink(missing_ok=True)
    except (OSError, ValueError):
        current_app.logger.exception('Could not remove obsolete avatar')


def decode_avatar(upload):
    limit = current_app.config['AVATAR_MAX_BYTES']
    raw = upload.read(limit + 1)
    if len(raw) > limit:
        return None, 'Аватарка должна быть не больше 5 МБ.'
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ('PNG', 'JPEG', 'WEBP') or image.width * image.height > 16_000_000:
                    return None, 'Выберите изображение PNG, JPEG или WebP до 16 мегапикселей.'
                image.verify()
            with Image.open(io.BytesIO(raw)) as image:
                result = ImageOps.exif_transpose(image).convert('RGBA')
                result.thumbnail((1024, 1024))
                output = io.BytesIO()
                result.save(output, format='PNG')
                return output.getvalue(), None
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return None, 'Не удалось прочитать изображение аватарки.'


def update_profile(user, data, files):
    allowed = {'username', 'email', 'display_name', 'bio', 'city', 'profile_visibility'}
    if set(data) - allowed or set(files) - {'avatar'}:
        return {'form': 'Запрос содержит недопустимые поля.'}
    fields = {}
    errors = {}
    for name in allowed & set(data):
        value = data[name]
        if not isinstance(value, str):
            errors[name] = 'Проверьте значение поля.'
            continue
        value = value.strip()
        if '\x00' in value:
            errors[name] = 'Проверьте значение поля.'
            continue
        if name in ('username', 'email'):
            field, error = validate_registration_identity(value if name == 'username' else user['username'], value if name == 'email' else user['email'])
            if error:
                errors[name] = error
            if name == 'email':
                value = value.lower()
        elif name in ('display_name', 'city') and len(value) > 100:
            errors[name] = 'Не больше 100 символов.'
        elif name == 'bio' and len(value) > 1000:
            errors[name] = 'Описание должно быть не длиннее 1000 символов.'
        elif name == 'profile_visibility' and value not in ('public', 'private'):
            errors[name] = 'Этот режим приватности пока недоступен.'
        fields[name] = value
    avatar = None
    if 'avatar' in files and files['avatar'].filename:
        avatar, error = decode_avatar(files['avatar'])
        if error:
            errors['avatar'] = error
    if errors:
        return errors
    if not fields and avatar is None:
        return {}
    filename = None
    old = None
    try:
        with get_db().transaction():
            if 'email' in fields and fields['email'] != user['email']:
                from auth.security import locked_security
                protection = locked_security(user['user_id'])
                if protection['two_factor_enabled']:
                    return {'email': 'Перед сменой почты отключите 2FA с подтверждением в разделе «Безопасность».'}
            row = queries.lock_user(user['user_id'])
            if not row:
                return {'form': 'Аккаунт больше недоступен. Войдите снова.'}
            if avatar is not None:
                filename = uuid.uuid4().hex + '.png'
                target = avatar_path(filename)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as output:
                    output.write(avatar)
                old = row['avatar_filename']
                fields['avatar_filename'] = filename
            queries.update_user(user['user_id'], fields)
    except UniqueViolation as error:
        remove_avatar(filename)
        constraint = error.diag.constraint_name or ''
        if 'username' in constraint:
            return {'username': 'Этот логин уже занят.'}
        if 'email' in constraint:
            return {'email': 'Эта почта уже занята.'}
        raise
    except Exception:
        remove_avatar(filename)
        raise
    if filename:
        remove_avatar(old)
    return {}
