import os
import random
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse

app = Flask(__name__)

# Берем токен ТОЛЬКО из переменных окружения (на Render)
BOT_TOKEN = os.environ.get("BOT_TOKEN")

# --- НАСТРОЙКИ ---
# Укажи ID партнёра (цифры) и ID свой (чтобы видеть оба настроения)
PARTNER_ID = "5475803324" 
MY_ID = "5475803324"
START_DATE = datetime(2023, 12, 10)

# Хранилище настроений в памяти (сбрасывается при перезапуске сервера)
moods = {MY_ID: "😐", PARTNER_ID: "😐"}

# Список милых фраз
COMPLIMENTS = [
    "Ты — мой самый любимый человек на свете. ❤️",
    "Я счастлив(а), что ты рядом. ✨",
    "Твоя улыбка делает мой день лучше. 😊",
    "Спасибо, что ты есть. 🥰",
    "Ты — мой личный источник вдохновения. 🌟",
    "Даже в самый пасмурный день ты — мое солнце. ☀️",
    "Я очень дорожу каждой минутой с тобой. ⏳"
]

def send_telegram_message(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Ошибка: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/check_user', methods=['POST'])
def check_user():
    data = request.get_json()
    init_data = data.get('initData')
    if not init_data: return jsonify({"error": "No initData"}), 400

    try:
        validate(init_data, BOT_TOKEN)
        parsed = parse(init_data)
        user = parsed.get('user', {})
        return jsonify({"status": "ok", "user_id": str(user.get('id')), "first_name": user.get('first_name')})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

@app.route('/api/ping', methods=['POST'])
def ping():
    data = request.get_json()
    sender_id = data.get('user_id')
    # Отправляем сообщение партнёру
    target_id = PARTNER_ID if str(sender_id) == MY_ID else MY_ID
    
    # Получаем случайный комплимент
    text = f"💖 <b>Сигнал внимания!</b>\n\n<i>{random.choice(COMPLIMENTS)}</i>"
    send_telegram_message(target_id, text)
    
    return jsonify({"status": "sent", "compliment": random.choice(COMPLIMENTS)})

@app.route('/api/days', methods=['GET'])
def days_together():
    delta = datetime.now() - START_DATE
    return jsonify({"days": delta.days})

# НОВЫЙ ЭНДПОИНТ: Обновление настроения
@app.route('/api/mood', methods=['POST'])
def update_mood():
    data = request.get_json()
    user_id = str(data.get('user_id'))
    mood = data.get('mood')
    
    if user_id in [MY_ID, PARTNER_ID]:
        moods[user_id] = mood
        # Отправляем уведомление партнёру
        target_id = PARTNER_ID if user_id == MY_ID else MY_ID
        send_telegram_message(target_id, f"Твоя половинка сейчас чувствует себя: {mood}")
    
    return jsonify({"status": "ok", "current_moods": moods})

# НОВЫЙ ЭНДПОИНТ: Получение текущих настроений
@app.route('/api/get_moods', methods=['GET'])
def get_moods():
    return jsonify(moods)

if __name__ == '__main__':
    app.run(debug=True)