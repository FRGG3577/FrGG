import os
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse

app = Flask(__name__)

# Токен берем из переменной окружения (на Render мы её настроим)
BOT_TOKEN = os.environ.get("BOT_TOKEN", "9138848491:AAFU47MNHy-vTPFFGN4QCFKEB7N76A4xViY")

@app.route('/')
def index():
    # Отдаем главную страницу
    return render_template('index.html')

@app.route('/api/check_user', methods=['POST'])
def check_user():
    # Сюда фронтенд будет присылать initData
    data = request.get_json()
    init_data = data.get('initData')

    if not init_data:
        return jsonify({"error": "No initData"}), 400

    try:
        # ГЛАВНОЕ: Проверяем подпись, чтобы убедиться, что данные пришли от Telegram
        validate(init_data, BOT_TOKEN)
        parsed = parse(init_data)
        user = parsed.get('user', {})
        return jsonify({
            "status": "ok",
            "user_id": user.get('id'),
            "first_name": user.get('first_name')
        })
    except Exception as e:
        # Если подпись неверная, доступ запрещен
        return jsonify({"error": str(e)}), 401

if __name__ == '__main__':
    app.run(debug=True)