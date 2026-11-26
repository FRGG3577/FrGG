import os
import random
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# --- НАСТРОЙКИ ---
BOT_TOKEN = os.environ.get("BOT_TOKEN")
DATABASE_URL = os.environ.get("DATABASE_URL")

# ОБЯЗАТЕЛЬНО ЗАМЕНИ НА РЕАЛЬНЫЕ ID (узнать можно через @userinfobot)
PARTNER_ID = "5475803324" 
MY_ID = "5475803324"      
START_DATE = datetime(2023, 12, 10)

def get_db():
    """Подключение к базе данных"""
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db():
    """Создает таблицы, если их нет"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS wishlist (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            date DATE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS moods (
            user_id TEXT PRIMARY KEY,
            mood TEXT DEFAULT '😐'
        );
    ''')
    conn.commit()
    cur.close()
    conn.close()

# Инициализируем базу при старте
try:
    init_db()
    print("База данных успешно инициализирована")
except Exception as e:
    print(f"Ошибка инициализации БД: {e}")

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
def send_telegram_message(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Ошибка отправки: {e}")

COMPLIMENTS = [
    "Ты — мой самый любимый человек на свете. ❤️",
    "Я счастлив(а), что ты рядом. ✨",
    "Твоя улыбка делает мой день лучше. 😊",
    "Спасибо, что ты есть. 🥰",
    "Ты — мой личный источник вдохновения. 🌟"
]

# --- МАРШРУТЫ ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ping')
def ping():
    # Этот маршрут нужен для Cron-job.org, чтобы Render не засыпал
    return "OK"

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
def ping_partner():
    text = f"💖 <b>Сигнал внимания!</b>\n\n<i>{random.choice(COMPLIMENTS)}</i>"
    send_telegram_message(PARTNER_ID, text)
    return jsonify({"status": "sent"})

@app.route('/api/days', methods=['GET'])
def days_together():
    delta = datetime.now() - START_DATE
    return jsonify({"days": delta.days})

@app.route('/api/wishlist', methods=['GET', 'POST', 'DELETE'])
def wishlist():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'GET':
        cur.execute("SELECT * FROM wishlist ORDER BY id DESC")
        items = cur.fetchall()
        cur.close(); conn.close()
        return jsonify(items)
    
    elif request.method == 'POST':
        item = request.get_json().get('item')
        if item:
            cur.execute("INSERT INTO wishlist (text) VALUES (%s)", (item,))
            conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "ok"})
    
    elif request.method == 'DELETE':
        item_id = request.args.get('id')
        cur.execute("DELETE FROM wishlist WHERE id = %s", (item_id,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "ok"})

@app.route('/api/notes', methods=['GET', 'POST'])
def notes():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'GET':
        cur.execute("SELECT * FROM notes ORDER BY id DESC")
        items = cur.fetchall()
        cur.close(); conn.close()
        # Форматируем дату для фронтенда
        for item in items:
            item['date'] = item['created_at'].strftime("%d.%m")
        return jsonify(items)
    
    elif request.method == 'POST':
        note = request.get_json().get('note')
        if note:
            cur.execute("INSERT INTO notes (text) VALUES (%s)", (note,))
            conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "ok"})

@app.route('/api/events', methods=['GET', 'POST', 'DELETE'])
def events():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'GET':
        cur.execute("SELECT * FROM events ORDER BY date ASC")
        items = cur.fetchall()
        cur.close(); conn.close()
        # Превращаем объект date в строку для JSON
        for item in items:
            item['date'] = item['date'].strftime("%Y-%m-%d")
        return jsonify(items)
    
    elif request.method == 'POST':
        data = request.get_json()
        text = data.get('text')
        date = data.get('date')
        if text and date:
            cur.execute("INSERT INTO events (text, date) VALUES (%s, %s)", (text, date))
            conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "ok"})
    
    elif request.method == 'DELETE':
        event_id = request.args.get('id')
        cur.execute("DELETE FROM events WHERE id = %s", (event_id,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "ok"})

@app.route('/api/mood', methods=['POST'])
def update_mood():
    data = request.get_json()
    user_id = str(data.get('user_id'))
    mood = data.get('mood')
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO moods (user_id, mood) VALUES (%s, %s)
        ON CONFLICT (user_id) DO UPDATE SET mood = EXCLUDED.mood
    ''', (user_id, mood))
    conn.commit()
    cur.close(); conn.close()
    
    target_id = PARTNER_ID if user_id == MY_ID else MY_ID
    send_telegram_message(target_id, f"Твоя половинка сейчас чувствует себя: {mood}")
    return jsonify({"status": "ok"})

@app.route('/api/get_moods', methods=['GET'])
def get_moods():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT user_id, mood FROM moods")
    rows = cur.fetchall()
    cur.close(); conn.close()
    
    moods = {row['user_id']: row['mood'] for row in rows}
    return jsonify(moods)

if __name__ == '__main__':
    app.run(debug=True)