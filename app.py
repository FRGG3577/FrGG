import os
import random
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from telegram_init_data import validate, parse
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN")
DATABASE_URL = os.environ.get("DATABASE_URL")  # Neon connection string

PARTNER_ID = "5475803324" 
MY_ID = "5475803324"
START_DATE = datetime(2023, 12, 10)

def get_db():
    """Возвращает соединение с БД"""
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    return conn

def init_db():
    """Создаёт таблицы при первом запуске"""
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

# Инициализация при старте
init_db()

# ... (функция send_telegram_message остаётся без изменений) ...

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

# Аналогично перепиши /api/notes и /api/events, используя SQL-запросы вместо работы с JSON.
# Для /api/mood используй UPSERT:
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
    
    # Уведомление партнёру
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