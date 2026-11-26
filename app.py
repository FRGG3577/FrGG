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
    return "", 204  # 204 No Content — сервер явно говорит, что тела ответа нет

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
# ... (твои существующие импорты)

# --- ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ ДЛЯ ИГРЫ ---
def init_game_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY DEFAULT 1,
            board TEXT DEFAULT '---------',
            turn TEXT DEFAULT 'X',
            winner TEXT DEFAULT '',
            last_move_by TEXT DEFAULT ''
        );
        INSERT INTO game_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    ''')
    conn.commit()
    cur.close()
    conn.close()

init_game_db()

# --- ЭНДПОИНТЫ ДЛЯ ИГРЫ ---

@app.route('/api/game/state', methods=['GET'])
def get_game_state():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM game_state WHERE id = 1")
    state = cur.fetchone()
    cur.close(); conn.close()
    return jsonify(state)

@app.route('/api/game/move', methods=['POST'])
def make_move():
    data = request.get_json()
    index = int(data.get('index'))
    user_id = str(data.get('user_id'))
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM game_state WHERE id = 1")
    state = cur.fetchone()
    
    board = list(state['board'])
    winner = state['winner']
    turn = state['turn']
    
    # Проверки: игра окончена, клетка занята, не твой ход
    if winner:
        cur.close(); conn.close()
        return jsonify({"error": "Игра уже окончена"}), 400
        
    if board[index] != '-':
        cur.close(); conn.close()
        return jsonify({"error": "Клетка занята"}), 400

    # Определяем, кто ходит (X или O) на основе ID
    # В нашем случае MY_ID ходит первым (X), PARTNER_ID вторым (O)
    expected_turn = 'X' if user_id == MY_ID else 'O'
    if turn != expected_turn:
        cur.close(); conn.close()
        return jsonify({"error": "Не твой ход"}), 400

    # Делаем ход
    board[index] = turn
    new_board = "".join(board)
    
    # Проверка на победу
    win_patterns = [
        [0,1,2], [3,4,5], [6,7,8], # Горизонтали
        [0,3,6], [1,4,7], [2,5,8], # Вертикали
        [0,4,8], [2,4,6]           # Диагонали
    ]
    
    new_winner = ''
    for p in win_patterns:
        if new_board[p[0]] == new_board[p[1]] == new_board[p[2]] != '-':
            new_winner = turn
            break
            
    if not new_winner and '-' not in new_board:
        new_winner = 'Draw' # Ничья

    # Меняем ход, если игра не окончена
    next_turn = 'O' if turn == 'X' else 'X'
    if new_winner: next_turn = turn

    cur.execute('''
        UPDATE game_state 
        SET board = %s, turn = %s, winner = %s, last_move_by = %s 
        WHERE id = 1
    ''', (new_board, next_turn, new_winner, user_id))
    conn.commit()
    
    cur.close(); conn.close()
    
    # Отправляем уведомление партнёру, что он должен сделать ход
    target_id = PARTNER_ID if user_id == MY_ID else MY_ID
    if not new_winner:
        send_telegram_message(target_id, "Твой ход в игре! 🎮")

    return jsonify({"status": "ok"})

# Маршрут для сброса игры
@app.route('/api/game/reset', methods=['POST'])
def reset_game():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE game_state SET board = '---------', turn = 'X', winner = '', last_move_by = '' WHERE id = 1")
    conn.commit()
    cur.close(); conn.close()
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True)