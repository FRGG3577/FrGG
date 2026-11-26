document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); 
    tg.expand();

    let currentUserId = null;
    let gameInterval = null;

    // ==========================================
    // 1. АВТОРИЗАЦИЯ
    // ==========================================
    fetch('/api/check_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'ok') {
            currentUserId = data.user_id;
            document.getElementById('status').textContent = 'Авторизован';
            document.getElementById('greeting').textContent = `Привет, ${data.first_name}!`;
        }
    })
    .catch(err => console.log("Ошибка авторизации:", err));

    // ==========================================
    // 2. СЧЕТЧИК ДНЕЙ
    // ==========================================
    fetch('/api/days')
        .then(res => res.json())
        .then(data => {
            document.getElementById('days-count').textContent = data.days;
        });

    // ==========================================
    // 3. НАСТРОЕНИЯ
    // ==========================================
    window.loadMoods = function() {
        fetch('/api/get_moods').then(res => res.json()).then(moods => {
            const ids = Object.keys(moods);
            if (ids.length >= 2) {
                document.querySelector('#my-mood .mood-emoji').textContent = moods[ids[0]] || '😐';
                document.querySelector('#partner-mood .mood-emoji').textContent = moods[ids[1]] || '😐';
            }
        });
    }
    loadMoods();

    window.setMood = function(emoji) {
        document.querySelector('#my-mood .mood-emoji').textContent = emoji;
        fetch('/api/mood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, mood: emoji })
        }).then(() => loadMoods());
    }

    window.sendHug = function() {
        const btn = document.getElementById('hug-button');
        btn.disabled = true; btn.textContent = 'Отправлено! 💌';
        if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff477e', '#ff7096'] });
        }
        fetch('/api/ping', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId })
        }).then(() => {
            showToast("Сигнал отправлен!");
            setTimeout(() => { btn.disabled = false; btn.textContent = '💖 Отправить сигнал'; }, 3000);
        });
    }

    // ==========================================
    // 4. НАВИГАЦИЯ ПО СТРАНИЦАМ
    // ==========================================
    window.switchPage = function(pageName, element) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Показываем нужную
        document.getElementById(`page-${pageName}`).classList.add('active');
        
        // Обновляем активный таб
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        element.classList.add('active');

        // Очищаем интервал игры, если уходим с неё
        if (window.gameInterval) {
            clearInterval(window.gameInterval);
            window.gameInterval = null;
        }

        // Загружаем данные при переходе
        if (pageName === 'wishlist') loadWishlist();
        if (pageName === 'notes') loadNotes();
        if (pageName === 'events') loadEvents();
        if (pageName === 'game') {
            loadGameState();
            // Обновляем состояние игры каждые 2 секунды
            window.gameInterval = setInterval(loadGameState, 2000);
        }
    }

    // ==========================================
    // 5. WISHLIST (ПЛАНЫ)
    // ==========================================
    window.loadWishlist = function() {
        fetch('/api/wishlist').then(res => res.json()).then(items => {
            const list = document.getElementById('wish-list');
            list.innerHTML = '';
            if(items.length === 0) list.innerHTML = '<p class="status-text">Пока пусто...</p>';
            items.forEach(item => {
                list.innerHTML += `
                    <li>
                        <span>${item.text}</span>
                        <button class="delete-btn" onclick="deleteWish('${item.id}')">×</button>
                    </li>`;
            });
        });
    }

    window.addWish = function() {
        const input = document.getElementById('wish-input');
        if (!input.value.trim()) return;
        fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: input.value })
        }).then(() => {
            input.value = '';
            loadWishlist();
            showToast("Добавлено в планы!");
        });
    }

    window.deleteWish = function(id) {
        fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' }).then(() => loadWishlist());
    }

    // ==========================================
    // 6. NOTES (ЗАПИСКИ)
    // ==========================================
    window.loadNotes = function() {
        fetch('/api/notes').then(res => res.json()).then(notes => {
            const list = document.getElementById('notes-list');
            list.innerHTML = '';
            if(notes.length === 0) list.innerHTML = '<p class="status-text">Пока нет записок...</p>';
            // Выводим в обратном порядке (новые сверху)
            notes.reverse().forEach(note => {
                list.innerHTML += `
                    <div class="note-item" style="background:#fff9c4; padding:15px; border-radius:12px; margin-bottom:10px; text-align:left; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
                        <p style="margin:0; font-size:15px;">${note.text}</p>
                        <small style="color:#999; font-size:11px;">${note.date || ''}</small>
                    </div>`;
            });
        });
    }

    window.addNote = function() {
        const input = document.getElementById('note-input');
        if (!input.value.trim()) return;
        fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: input.value })
        }).then(() => {
            input.value = '';
            loadNotes();
            showToast("Записка оставлена!");
        });
    }

    // ==========================================
    // 7. EVENTS (КАЛЕНДАРЬ)
    // ==========================================
    window.loadEvents = function() {
        fetch('/api/events').then(res => res.json()).then(events => {
            const list = document.getElementById('events-list');
            list.innerHTML = '';
            const today = new Date();
            today.setHours(0,0,0,0);

            if (events.length === 0) {
                list.innerHTML = '<p class="status-text">Пока нет событий. Добавьте первое!</p>';
                return;
            }

            events.forEach(event => {
                const eventDate = new Date(event.date);
                const timeDiff = eventDate.getTime() - today.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                
                let daysText = '';
                let colorClass = 'color: #666;';
                
                if (daysLeft === 0) {
                    daysText = 'Сегодня! 🎉';
                    colorClass = 'color: #ff477e; font-weight: bold;';
                } else if (daysLeft === 1) {
                    daysText = 'Завтра 🔥';
                    colorClass = 'color: #ff477e; font-weight: bold;';
                } else if (daysLeft > 0) {
                    daysText = `Через ${daysLeft} дн.`;
                    if (daysLeft <= 3) colorClass = 'color: #ff7f00;'; 
                } else {
                    daysText = 'Прошло';
                    colorClass = 'color: #999; text-decoration: line-through;';
                }

                const dateParts = event.date.split('-');
                const formatDate = `${dateParts[2]}.${dateParts[1]}`;

                list.innerHTML += `
                    <li style="border-left-color: ${daysLeft <= 3 && daysLeft >= 0 ? '#ff477e' : '#a18cd1'};">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 4px;">${event.text}</div>
                            <div style="font-size: 12px; color: #888;">
                                ${formatDate} — <span style="${colorClass}">${daysText}</span>
                            </div>
                        </div>
                        <button class="delete-btn" onclick="deleteEvent('${event.id}')">×</button>
                    </li>`;
            });
        });
    }

    window.addEvent = function() {
        const text = document.getElementById('event-input').value;
        const date = document.getElementById('date-input').value;
        
        if (!text.trim() || !date) {
            showToast("Заполните все поля!");
            return;
        }

        fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, date: date })
        }).then(() => {
            document.getElementById('event-input').value = '';
            document.getElementById('date-input').value = '';
            loadEvents();
            showToast("Событие добавлено!");
        });
    }

    window.deleteEvent = function(id) {
        fetch(`/api/events?id=${id}`, { method: 'DELETE' }).then(() => loadEvents());
    }

    // ==========================================
    // 8. ИГРА (КРЕСТИКИ-НОЛИКИ)
    // ==========================================
    window.loadGameState = function() {
        fetch('/api/game/state')
            .then(res => res.json())
            .then(state => {
                const boardElement = document.getElementById('game-board');
                const statusElement = document.getElementById('game-status');
                
                if (!boardElement || !statusElement) return; // Если мы не на странице игры

                // Создаем клетки, если их нет
                if (boardElement.children.length === 0) {
                    for (let i = 0; i < 9; i++) {
                        const cell = document.createElement('div');
                        cell.className = 'cell';
                        cell.onclick = () => makeMove(i);
                        boardElement.appendChild(cell);
                    }
                }

                // Обновляем визуально
                const board = state.board.split('');
                for (let i = 0; i < 9; i++) {
                    const cell = boardElement.children[i];
                    cell.textContent = board[i] === '-' ? '' : board[i];
                    // Добавляем класс X или O для цвета
                    cell.className = 'cell' + (board[i] !== '-' ? ' ' + board[i] : '');
                }

                // Обновляем статус игры
                if (state.winner === 'X') {
                    statusElement.innerHTML = '<span style="color:#ff477e; font-weight:bold; font-size:18px;">Победили Крестики! 🎉</span>';
                } else if (state.winner === 'O') {
                    statusElement.innerHTML = '<span style="color:#a18cd1; font-weight:bold; font-size:18px;">Победили Нолики! 🎉</span>';
                } else if (state.winner === 'Draw') {
                    statusElement.innerHTML = '<span style="color:#666; font-weight:bold; font-size:18px;">Ничья! 🤝</span>';
                } else {
                    // ВАЖНО: Замени 'ТВОЙ_ID' на свой реальный Telegram ID (цифры)
                    const mySymbol = (currentUserId === '5475803324') ? 'X' : 'O'; 
                    
                    if (state.turn === mySymbol) {
                        statusElement.innerHTML = '<span style="color:#333; font-weight:bold;">Твой ход</span>';
                    } else {
                        statusElement.innerHTML = '<span style="color:#888;">Ход партнёра...</span>';
                    }
                }
            });
    }

    window.makeMove = function(index) {
        if (!currentUserId) return;
        fetch('/api/game/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index, user_id: currentUserId })
        }).then(res => res.json()).then(data => {
            if (data.error) {
                showToast(data.error);
            } else {
                loadGameState(); // Мгновенно обновляем экран
            }
        });
    }

    window.resetGame = function() {
        fetch('/api/game/reset', { method: 'POST' }).then(() => {
            loadGameState();
            showToast("Игра начата заново!");
        });
    }

    // ==========================================
    // 9. ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ (TOAST)
    // ==========================================
    function showToast(text) {
        const toast = document.getElementById('toast');
        toast.textContent = text;
        toast.style.bottom = '80px'; 
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }

}); // Конец DOMContentLoaded