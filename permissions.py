from functools import wraps
from flask import g, redirect, url_for, request, jsonify


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.get('user') is None:
            if request.path.startswith('/settings/'):
                return jsonify(error='Войдите в аккаунт, чтобы продолжить.'), 401
            return redirect(url_for('main.index', auth='login'))
        return view(*args, **kwargs)
    return wrapped
