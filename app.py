import os
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse

app = Flask(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN")

# --- НАСТРОЙКИ ДЛЯ ВАС ---
# Укажи здесь ID твоего партнёра (или свой), кому будут приходить уведомления.
# Узнать ID можно, написав боту @userinfobot в Telegram.
PARTNER_CHAT_ID = "5475803324" 
# Дата начала ваших отношений (Год, Месяц, День)
START_DATE = datetime(2023, 12, 10) 

def send_telegram_message(chat_id, text):
    """Вспомогательная функция для отправки сообщения через Telegram API"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Ошибка отправки сообщения: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/check_user', methods=['POST'])
def check_user():
    data = request.get_json()
    init_data = data.get('initData')

    if not init_data:
        return jsonify({"error": "No initData"}), 400

    try:
        validate(init_data, BOT_TOKEN)
        parsed = parse(init_data)
        user = parsed.get('user', {})
        return jsonify({
            "status": "ok",
            "user_id": user.get('id'),
            "first_name": user.get('first_name')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 401

# --- НОВЫЕ ЭНДПОИНТЫ ---

@app.route('/api/ping', methods=['POST'])
def ping():
    """Отправляет уведомление партнёру"""
    # В реальном приложении здесь нужно проверять initData, 
    # чтобы убедиться, что запрос от вас, но для простоты пока пропустим.
    
    send_telegram_message(PARTNER_CHAT_ID, "💖 <b>Твоя половинка думает о тебе!</b> 💖\n\n<i>Крепко обнимаю...</i>")
    return jsonify({"status": "sent"})

@app.route('/api/days', methods=['GET'])
def days_together():
    """Считает дни вместе"""
    today = datetime.now()
    delta = today - START_DATE
    return jsonify({"days": delta.days})

if __name__ == '__main__':
    app.run(debug=True)