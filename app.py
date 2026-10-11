from flask import Flask, g, render_template, request, jsonify
from config import load_config
from database import close_db
from flask_wtf.csrf import CSRFProtect, CSRFError
from auth.routes import bp as auth_bp, load_current_user
from auth.security_routes import bp as security_bp
from main.routes import bp as main_bp
from pathlib import Path
from profile_backend.routes import bp as profile_bp, profile_data
from diary.routes import bp as diary_bp
from playlists.routes import bp as playlists_bp, view_playlist
from playlists import queries as playlist_queries
from diary.routes import view_track


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(load_config())
    if test_config:
        app.config.update(test_config)
    if not app.config.get('SECRET_KEY'):
        raise RuntimeError('SECRET_KEY must be configured')
    CSRFProtect(app)
    app.teardown_appcontext(close_db)
    app.before_request(load_current_user)
    app.register_blueprint(auth_bp)
    app.register_blueprint(security_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(diary_bp)
    app.register_blueprint(playlists_bp)
    @app.context_processor
    def playlist_context():
        if not g.get('user'):
            return {'user_playlists': [], 'available_tracks': []}
        return {'user_playlists': [view_playlist(r) for r in playlist_queries.list_owned(g.user['user_id']) if not r.get('system_key')],
                'available_tracks': [view_track(r) for r in playlist_queries.available(g.user['user_id'])]}
    app.context_processor(lambda: {'account': profile_data(g.user) if g.get('user') else None})
    app.context_processor(lambda: {'is_member': g.get('user') is not None})

    @app.url_defaults
    def static_version(endpoint, values):
        if endpoint == 'static' and 'filename' in values:
            path = Path(app.static_folder) / values['filename']
            if path.is_file():
                values['v'] = str(path.stat().st_mtime_ns)

    @app.after_request
    def private_response(response):
        if (request.method == 'GET' and response.status_code == 200 and response.mimetype == 'text/html'
                and request.headers.get('Sec-Fetch-Dest') == 'document' and g.get('user')
                and 'data-player-user=' in response.get_data(as_text=True)):
            response.set_data(render_template('layouts/player_shell.html'))
        if request.endpoint != 'static':
            response.headers['Cache-Control'] = 'no-store'
        return response

    def error_response(error):
        code = getattr(error, 'code', 500)
        messages = {400: 'Некорректный запрос. Обновите страницу и попробуйте снова.',
                    403: 'Доступ запрещён.', 404: 'Страница не найдена.',
                    413: 'Размер запроса превышает допустимый лимит.',
                    500: 'Не удалось выполнить запрос. Попробуйте позже.'}
        message = messages.get(code, 'Ошибка запроса.')
        if request.path.startswith(('/auth/', '/settings/')) or request.accept_mimetypes.best == 'application/json':
            return jsonify(error=message), code
        return render_template('404.html', error_code=code, error_message=message), code

    for code in (400, 403, 404, 413, 500):
        app.register_error_handler(code, error_response)
    app.register_error_handler(CSRFError, error_response)
    return app


if __name__ == '__main__':
    create_app().run(debug=False)
