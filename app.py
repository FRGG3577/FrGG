import os
import json
import random
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse

app = Flask(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN")
PARTNER_ID = "5475803324" 
MY_ID = "5475803324"
START_DATE = datetime(2023, 12, 10)

# --- РАБОТА С ДАННЫМИ (JSON) ---
DATA_FILE = 'data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "wishlist": [], 
        "notes": [], 
        "events": [], # <-- НОВОЕ
        "moods": {MY_ID: "😐", PARTNER_ID: "😐"}
    }

# В самом низу app.py добавь новые маршруты:
@app.route('/api/events', methods=['GET', 'POST', 'DELETE'])
def events():
    global db
    if request.method == 'GET':
        # Сортируем по дате
        sorted_events = sorted(db.get("events", []), key=lambda x: x["date"])
        return jsonify(sorted_events)
    elif request.method == 'POST':
        data = request.get_json()
        event_text = data.get('text')
        event_date = data.get('date') # формат "YYYY-MM-DD"
        if event_text and event_date:
            db["events"].append({
                "id": str(random.randint(1000, 9999)), 
                "text": event_text,
                "date": event_date
            })
            save_data(db)
        return jsonify({"status": "ok"})
    elif request.method == 'DELETE':
        event_id = request.args.get('id')
        db["events"] = [e for e in db["events"] if e["id"] != event_id]
        save_data(db)
        return jsonify({"status": "ok"})

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# Инициализация данных при старте
db = load_data()

COMPLIMENTS = [
    "Ты — мой самый любимый человек на свете. ❤️",
    "Я счастлив(а), что ты рядом. ✨",
    "Твоя улыбка делает мой день лучше. 😊",
    "Спасибо, что ты есть. 🥰",
    "Ты — мой личный источник вдохновения. 🌟"
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
    text = f"💖 <b>Сигнал внимания!</b>\n\n<i>{random.choice(COMPLIMENTS)}</i>"
    send_telegram_message(PARTNER_ID, text)
    return jsonify({"status": "sent"})

@app.route('/api/days', methods=['GET'])
def days_together():
    delta = datetime.now() - START_DATE
    return jsonify({"days": delta.days})

@app.route('/api/mood', methods=['POST'])
def update_mood():
    data = request.get_json()
    user_id = str(data.get('user_id'))
    mood = data.get('mood')
    if user_id in [MY_ID, PARTNER_ID]:
        db["moods"][user_id] = mood
        save_data(db)
    return jsonify({"status": "ok"})

@app.route('/api/get_moods', methods=['GET'])
def get_moods():
    return jsonify(db["moods"])

# --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ СТРАНИЦ ---

@app.route('/api/wishlist', methods=['GET', 'POST', 'DELETE'])
def wishlist():
    global db
    if request.method == 'GET':
        return jsonify(db["wishlist"])
    elif request.method == 'POST':
        item = request.get_json().get('item')
        if item:
            db["wishlist"].append({"id": str(random.randint(1000, 9999)), "text": item})
            save_data(db)
        return jsonify({"status": "ok"})
    elif request.method == 'DELETE':
        item_id = request.args.get('id')
        db["wishlist"] = [i for i in db["wishlist"] if i["id"] != item_id]
        save_data(db)
        return jsonify({"status": "ok"})

@app.route('/api/notes', methods=['GET', 'POST'])
def notes():
    global db
    if request.method == 'GET':
        return jsonify(db["notes"])
    elif request.method == 'POST':
        note = request.get_json().get('note')
        if note:
            # Берем первые 50 символов для заголовка, остальное в текст
            db["notes"].append({"id": str(random.randint(1000, 9999)), "text": note, "date": datetime.now().strftime("%d.%m")})
            save_data(db)
        return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True)