                                                           

       
                               

                                                                              
                                                                        
   

from datetime import datetime

from flask import Flask, request


console_app = Flask(__name__)


@console_app.after_request
def allow_local_site(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@console_app.post("/__developer_console")
def receive_developer_event():
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "Неизвестное действие")).strip()[:500]
    page = str(payload.get("page", "неизвестная страница")).strip()[:200]
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[Sonary {timestamp}] {message} | страница: {page}", flush=True)
    return "", 204


if __name__ == "__main__":
    print("=" * 64)
    print("Мини-консоль Sonary запущена.")
    print("Оставьте это окно открытым и пользуйтесь сайтом как обычно.")
    print("Для остановки нажмите Ctrl+C.")
    print("=" * 64)
    console_app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)
