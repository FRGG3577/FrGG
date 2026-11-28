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
PARTNER_ID = "5475803324" 
MY_ID = "5475803324" 
START_DATE = datetime(2023, 12, 10) # ЗАМЕНИ

def get_db():
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS wishlist (id SERIAL PRIMARY KEY, text TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, text TEXT NOT NULL, date DATE NOT NULL);
        CREATE TABLE IF NOT EXISTS moods (user_id TEXT PRIMARY KEY, mood TEXT DEFAULT '😐');
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY DEFAULT 1, board TEXT DEFAULT '---------', turn TEXT DEFAULT 'X', winner TEXT DEFAULT ''
        );
        INSERT INTO game_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
        CREATE TABLE IF NOT EXISTS records_2048 (user_id TEXT PRIMARY KEY, score INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS records_snake (user_id TEXT PRIMARY KEY, score INTEGER DEFAULT 0);
    ''')
    conn.commit()
    cur.close()
    conn.close()

init_db()

def send_telegram_message(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try: requests.post(url, json=payload)
    except Exception as e: print(f"Ошибка: {e}")

@app.route('/')
def index(): return render_template('index.html')

@app.route('/ping')
def ping(): return "OK"

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
    except Exception as e: return jsonify({"error": str(e)}), 401

@app.route('/api/ping', methods=['POST'])
def send_ping():
    send_telegram_message(PARTNER_ID, "💖 <b>Твоя половинка думает о тебе!</b> 💖")
    return jsonify({"status": "sent"})

@app.route('/api/days', methods=['GET'])
def days_together():
    delta = datetime.now() - START_DATE
    return jsonify({"days": delta.days})

# --- НАСТРОЕНИЯ (С УВЕДОМЛЕНИЕМ) ---
@app.route('/api/mood', methods=['POST'])
def update_mood():
    data = request.get_json()
    user_id, mood = str(data.get('user_id')), data.get('mood')
    conn = get_db()
    cur = conn.cursor()
    cur.execute('INSERT INTO moods (user_id, mood) VALUES (%s, %s) ON CONFLICT (user_id) DO UPDATE SET mood = EXCLUDED.mood', (user_id, mood))
    conn.commit()
    cur.close(); conn.close()
    
    target_id = PARTNER_ID if user_id == MY_ID else MY_ID
    send_telegram_message(target_id, f"Твоя половинка сменила настроение на {mood} 😊")
    return jsonify({"status": "ok"})

@app.route('/api/get_moods', methods=['GET'])
def get_moods():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT user_id, mood FROM moods")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify({row['user_id']: row['mood'] for row in rows})

# --- ОСТАЛЬНЫЕ API (WISHLIST, EVENTS, NOTES, КРЕСТИКИ) ---
# (Оставляем как было в предыдущем коде, они работают)

@app.route('/api/wishlist', methods=['GET', 'POST', 'DELETE'])
def wishlist():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    if request.method == 'GET':
        cur.execute("SELECT * FROM wishlist ORDER BY id DESC"); res = cur.fetchall()
    elif request.method == 'POST':
        cur.execute("INSERT INTO wishlist (text) VALUES (%s)", (request.get_json().get('item'),)); conn.commit(); res = {"status": "ok"}
    elif request.method == 'DELETE':
        cur.execute("DELETE FROM wishlist WHERE id = %s", (request.args.get('id'),)); conn.commit(); res = {"status": "ok"}
    cur.close(); conn.close(); return jsonify(res)

@app.route('/api/events', methods=['GET', 'POST', 'DELETE'])
def events():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    if request.method == 'GET':
        cur.execute("SELECT * FROM events ORDER BY date ASC"); res = cur.fetchall()
    elif request.method == 'POST':
        data = request.get_json(); cur.execute("INSERT INTO events (text, date) VALUES (%s, %s)", (data.get('text'), data.get('date'))); conn.commit(); res = {"status": "ok"}
    elif request.method == 'DELETE':
        cur.execute("DELETE FROM events WHERE id = %s", (request.args.get('id'),)); conn.commit(); res = {"status": "ok"}
    cur.close(); conn.close(); return jsonify(res)

@app.route('/api/notes', methods=['GET', 'POST', 'DELETE'])
def notes():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    if request.method == 'GET':
        cur.execute("SELECT * FROM notes ORDER BY id DESC"); res = cur.fetchall()
    elif request.method == 'POST':
        cur.execute("INSERT INTO notes (text) VALUES (%s)", (request.get_json().get('note'),)); conn.commit(); res = {"status": "ok"}
    elif request.method == 'DELETE':
        cur.execute("DELETE FROM notes WHERE id = %s", (request.args.get('id'),)); conn.commit(); res = {"status": "ok"}
    cur.close(); conn.close(); return jsonify(res)

@app.route('/api/game/state', methods=['GET'])
def get_game_state():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM game_state WHERE id = 1"); state = cur.fetchone(); cur.close(); conn.close(); return jsonify(state)

@app.route('/api/game/move', methods=['POST'])
def make_move():
    data = request.get_json(); index, user_id = int(data.get('index')), str(data.get('user_id'))
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM game_state WHERE id = 1"); state = cur.fetchone()
    board, turn, winner = list(state['board']), state['turn'], state['winner']
    if winner: cur.close(); conn.close(); return jsonify({"error": "Игра окончена"}), 400
    if board[index] != '-': cur.close(); conn.close(); return jsonify({"error": "Занято"}), 400
    expected_turn = 'X' if user_id == MY_ID else 'O'
    if turn != expected_turn: cur.close(); conn.close(); return jsonify({"error": "Не твой ход"}), 400
    board[index] = turn; new_board = "".join(board)
    win_patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    for p in win_patterns:
        if new_board[p[0]] == new_board[p[1]] == new_board[p[2]] != '-': winner = turn; break
    if not winner and '-' not in new_board: winner = 'Draw'
    next_turn = 'O' if turn == 'X' else 'X'
    if winner: next_turn = turn
    cur.execute('UPDATE game_state SET board = %s, turn = %s, winner = %s WHERE id = 1', (new_board, next_turn, winner)); conn.commit()
    cur.close(); conn.close()
    if not winner: send_telegram_message(PARTNER_ID if user_id == MY_ID else MY_ID, "Твой ход в крестиках! 🎮")
    return jsonify({"status": "ok"})

@app.route('/api/game/reset', methods=['POST'])
def reset_game():
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE game_state SET board = '---------', turn = 'X', winner = '' WHERE id = 1"); conn.commit(); cur.close(); conn.close(); return jsonify({"status": "ok"})

@app.route('/api/2048/records', methods=['GET'])
def get_2048_records():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM records_2048 ORDER BY score DESC"); res = cur.fetchall(); cur.close(); conn.close(); return jsonify(res)

@app.route('/api/2048/score', methods=['POST'])
def save_2048_score():
    data = request.get_json(); user_id, score = str(data.get('user_id')), data.get('score')
    conn = get_db(); cur = conn.cursor()
    cur.execute('INSERT INTO records_2048 (user_id, score) VALUES (%s, %s) ON CONFLICT (user_id) DO UPDATE SET score = GREATEST(records_2048.score, EXCLUDED.score)', (user_id, score)); conn.commit(); cur.close(); conn.close(); return jsonify({"status": "ok"})

@app.route('/api/snake/records', methods=['GET'])
def get_snake_records():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM records_snake ORDER BY score DESC"); res = cur.fetchall(); cur.close(); conn.close(); return jsonify(res)

@app.route('/api/snake/score', methods=['POST'])
def save_snake_score():
    data = request.get_json(); user_id, score = str(data.get('user_id')), data.get('score')
    conn = get_db(); cur = conn.cursor()
    cur.execute('INSERT INTO records_snake (user_id, score) VALUES (%s, %s) ON CONFLICT (user_id) DO UPDATE SET score = GREATEST(records_snake.score, EXCLUDED.score)', (user_id, score)); conn.commit(); cur.close(); conn.close(); return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True)