document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); tg.expand();

    let currentUserId = null;
    let gameInterval = null;

    // 1. АВТОРИЗАЦИЯ
    fetch('/api/check_user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData })
    }).then(res => res.json()).then(data => {
        if (data.status === 'ok') {
            currentUserId = data.user_id;
            document.getElementById('status').textContent = 'Авторизован';
            document.getElementById('greeting').textContent = `Привет, ${data.first_name}!`;
        }
    });

    // 2. ДНИ И НАСТРОЕНИЯ
    fetch('/api/days').then(res => res.json()).then(data => document.getElementById('days-count').textContent = data.days);
    
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
        fetch('/api/mood', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, mood: emoji }) }).then(() => loadMoods());
    }

    window.sendHug = function() {
        const btn = document.getElementById('hug-button');
        btn.disabled = true; btn.textContent = 'Отправлено! 💌';
        if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff477e', '#ff7096'] });
        fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId }) }).then(() => {
            showToast("Сигнал отправлен!");
            setTimeout(() => { btn.disabled = false; btn.textContent = '💖 Отправить сигнал'; }, 3000);
        });
    }

    // 3. НАВИГАЦИЯ
    window.switchPage = function(pageName, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${pageName}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        element.classList.add('active');

        if (window.gameInterval) { clearInterval(window.gameInterval); window.gameInterval = null; }
        if (pageName === 'todo') loadWishlist(); 
        if (pageName === 'notes') loadNotes();
        if (pageName === 'games') { loadGameState(); window.gameInterval = setInterval(loadGameState, 2000); load2048Records(); }
        if (pageName === 'random') updateWheel();
    }

    window.switchTab = function(tabName, element) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`tab-content-${tabName}`).classList.add('active');
        if (tabName === 'wishlist') loadWishlist();
        if (tabName === 'events') loadEvents();
    }

    window.switchGameTab = function(gameName, element) {
        document.querySelectorAll('.tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
        document.querySelectorAll('.game-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`game-${gameName}`).classList.add('active');
        if (gameName === 'game2048') load2048Records();
    }

    // 4. ПЛАНЫ
    window.loadWishlist = function() {
        fetch('/api/wishlist').then(res => res.json()).then(items => {
            const list = document.getElementById('wish-list'); list.innerHTML = '';
            if(items.length === 0) list.innerHTML = '<p class="status-text">Пока пусто...</p>';
            items.forEach(item => { list.innerHTML += `<li><span>${item.text}</span><button class="delete-btn" onclick="deleteWish('${item.id}')">×</button></li>`; });
        });
    }
    window.addWish = function() {
        const input = document.getElementById('wish-input'); if (!input.value.trim()) return;
        fetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: input.value }) }).then(() => { input.value = ''; loadWishlist(); showToast("Добавлено!"); });
    }
    window.deleteWish = function(id) { fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' }).then(() => loadWishlist()); }

    // 5. СОБЫТИЯ
    window.loadEvents = function() {
        fetch('/api/events').then(res => res.json()).then(events => {
            const list = document.getElementById('events-list'); list.innerHTML = '';
            const today = new Date(); today.setHours(0,0,0,0);
            if (events.length === 0) { list.innerHTML = '<p class="status-text">Пока нет событий.</p>'; return; }
            events.forEach(event => {
                const eventDate = new Date(event.date); const timeDiff = eventDate.getTime() - today.getTime(); const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                let daysText = ''; let colorClass = 'color: #666;';
                if (daysLeft === 0) { daysText = 'Сегодня! 🎉'; colorClass = 'color: #ff477e; font-weight: bold;'; }
                else if (daysLeft === 1) { daysText = 'Завтра 🔥'; colorClass = 'color: #ff477e; font-weight: bold;'; }
                else if (daysLeft > 0) { daysText = `Через ${daysLeft} дн.`; if (daysLeft <= 3) colorClass = 'color: #ff7f00;'; }
                else { daysText = 'Прошло'; colorClass = 'color: #999; text-decoration: line-through;'; }
                const dateParts = event.date.split('-'); const formatDate = `${dateParts[2]}.${dateParts[1]}`;
                list.innerHTML += `<li style="border-left-color: ${daysLeft <= 3 && daysLeft >= 0 ? '#ff477e' : '#a18cd1'};"><div><div style="font-weight: bold; margin-bottom: 4px;">${event.text}</div><div style="font-size: 12px; color: #888;">${formatDate} — <span style="${colorClass}">${daysText}</span></div></div><button class="delete-btn" onclick="deleteEvent('${event.id}')">×</button></li>`;
            });
        });
    }
    window.addEvent = function() {
        const text = document.getElementById('event-input').value; const date = document.getElementById('date-input').value;
        if (!text.trim() || !date) { showToast("Заполните поля!"); return; }
        fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, date: date }) }).then(() => { document.getElementById('event-input').value = ''; document.getElementById('date-input').value = ''; loadEvents(); showToast("Событие добавлено!"); });
    }
    window.deleteEvent = function(id) { fetch(`/api/events?id=${id}`, { method: 'DELETE' }).then(() => loadEvents()); }

    // 6. ЗАПИСКИ (С УДАЛЕНИЕМ)
    window.loadNotes = function() {
        fetch('/api/notes').then(res => res.json()).then(notes => {
            const list = document.getElementById('notes-list'); list.innerHTML = '';
            if(notes.length === 0) list.innerHTML = '<p class="status-text">Пока нет записок...</p>';
            notes.forEach(note => {
                list.innerHTML += `<div class="note-item" style="background:#fff9c4; padding:15px; border-radius:12px; margin-bottom:10px; text-align:left; box-shadow: 2px 2px 5px rgba(0,0,0,0.05); position: relative;"><p style="margin:0; font-size:15px;">${note.text}</p><small style="color:#999; font-size:11px;">${note.created_at ? new Date(note.created_at).toLocaleDateString() : ''}</small><button class="delete-btn" onclick="deleteNote('${note.id}')" style="position:absolute; top:10px; right:10px; color:#ff6b6b; background:none; border:none; font-size:18px; cursor:pointer;">×</button></div>`;
            });
        });
    }
    window.addNote = function() {
        const input = document.getElementById('note-input'); if (!input.value.trim()) return;
        fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: input.value }) }).then(() => { input.value = ''; loadNotes(); showToast("Записка оставлена!"); });
    }
    window.deleteNote = function(id) { if(confirm("Удалить эту записку?")) { fetch(`/api/notes?id=${id}`, { method: 'DELETE' }).then(() => loadNotes()); } }

    // 7. КРЕСТИКИ-НОЛИКИ
    window.loadGameState = function() {
        fetch('/api/game/state').then(res => res.json()).then(state => {
            const boardElement = document.getElementById('game-board'); const statusElement = document.getElementById('game-status');
            if (!boardElement || !statusElement) return;
            if (boardElement.children.length === 0) { for (let i = 0; i < 9; i++) { const cell = document.createElement('div'); cell.className = 'cell'; cell.onclick = () => makeMove(i); boardElement.appendChild(cell); } }
            const board = state.board.split('');
            for (let i = 0; i < 9; i++) { const cell = boardElement.children[i]; cell.textContent = board[i] === '-' ? '' : board[i]; cell.className = 'cell' + (board[i] !== '-' ? ' ' + board[i] : ''); }
            if (state.winner === 'X') statusElement.innerHTML = '<span style="color:#ff477e; font-weight:bold; font-size:18px;">Победили Крестики! 🎉</span>';
            else if (state.winner === 'O') statusElement.innerHTML = '<span style="color:#a18cd1; font-weight:bold; font-size:18px;">Победили Нолики! 🎉</span>';
            else if (state.winner === 'Draw') statusElement.innerHTML = '<span style="color:#666; font-weight:bold; font-size:18px;">Ничья! 🤝</span>';
            else { const mySymbol = (currentUserId === 'ТВОЙ_ID') ? 'X' : 'O'; if (state.turn === mySymbol) statusElement.innerHTML = '<span style="color:#333; font-weight:bold;">Твой ход</span>'; else statusElement.innerHTML = '<span style="color:#888;">Ход партнёра...</span>'; }
        });
    }
    window.makeMove = function(index) {
        if (!currentUserId) return;
        fetch('/api/game/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: index, user_id: currentUserId }) }).then(res => res.json()).then(data => { if (data.error) showToast(data.error); else loadGameState(); });
    }
    window.resetGame = function() { fetch('/api/game/reset', { method: 'POST' }).then(() => { loadGameState(); showToast("Игра начата!"); }); }

    // 8. ИГРА 2048
    let board2048 = []; let score2048 = 0;
    window.init2048 = function() {
        board2048 = Array(16).fill(0); score2048 = 0;
        document.getElementById('my-score').textContent = "0";
        addRandomTile(); addRandomTile(); render2048();
    }
    function addRandomTile() { const empty = board2048.map((v, i) => v === 0 ? i : null).filter(v => v !== null); if (empty.length > 0) { const randomIndex = empty[Math.floor(Math.random() * empty.length)]; board2048[randomIndex] = Math.random() < 0.9 ? 2 : 4; } }
    function render2048() { const grid = document.getElementById('grid-2048'); grid.innerHTML = ''; board2048.forEach(val => { const tile = document.createElement('div'); tile.className = `tile-2048 ${val !== 0 ? 'tile-' + val : ''}`; tile.textContent = val !== 0 ? val : ''; grid.appendChild(tile); }); }
    window.saveScore2048 = function() {
        if (!currentUserId || score2048 === 0) return;
        fetch('/api/2048/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, score: score2048 }) }).then(() => { showToast("Рекорд сохранен!"); load2048Records(); });
    }
    window.load2048Records = function() {
        fetch('/api/2048/records').then(res => res.json()).then(records => {
            const myRec = records.find(r => r.user_id === currentUserId);
            const partnerRec = records.find(r => r.user_id !== currentUserId);
            document.getElementById('my-score').textContent = myRec ? myRec.score : 0;
            document.getElementById('partner-score').textContent = partnerRec ? partnerRec.score : 0;
        });
    }
    // Базовая логика свайпов для 2048 (упрощенная)
    let touchStartX = 0, touchStartY = 0;
    document.getElementById('grid-2048').addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, {passive: true});
    document.getElementById('grid-2048').addEventListener('touchend', e => {
        const diffX = e.changedTouches[0].clientX - touchStartX; const diffY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(diffX) > Math.abs(diffY)) { if (diffX > 30) move2048('right'); else if (diffX < -30) move2048('left'); }
        else { if (diffY > 30) move2048('down'); else if (diffY < -30) move2048('up'); }
    }, {passive: true});

    function move2048(direction) {
        // Упрощенная логика для демонстрации (для идеала нужен полный алгоритм)
        let moved = false;
        if (direction === 'left' || direction === 'right') {
            for (let r = 0; r < 4; r++) {
                let row = [board2048[r*4], board2048[r*4+1], board2048[r*4+2], board2048[r*4+3]];
                if (direction === 'right') row.reverse();
                let newRow = row.filter(v => v !== 0);
                for (let i = 0; i < newRow.length - 1; i++) { if (newRow[i] === newRow[i+1]) { newRow[i] *= 2; score2048 += newRow[i]; newRow[i+1] = 0; moved = true; } }
                newRow = newRow.filter(v => v !== 0); while (newRow.length < 4) newRow.push(0);
                if (direction === 'right') newRow.reverse();
                for (let c = 0; c < 4; c++) board2048[r*4+c] = newRow[c];
            }
        } else if (direction === 'up' || direction === 'down') {
             for (let c = 0; c < 4; c++) {
                let col = [board2048[c], board2048[c+4], board2048[c+8], board2048[c+12]];
                if (direction === 'down') col.reverse();
                let newCol = col.filter(v => v !== 0);
                for (let i = 0; i < newCol.length - 1; i++) { if (newCol[i] === newCol[i+1]) { newCol[i] *= 2; score2048 += newCol[i]; newCol[i+1] = 0; moved = true; } }
                newCol = newCol.filter(v => v !== 0); while (newCol.length < 4) newCol.push(0);
                if (direction === 'down') newCol.reverse();
                for (let r = 0; r < 4; r++) board2048[r*4+c] = newCol[r];
            }
        }
        if (moved) { addRandomTile(); render2048(); document.getElementById('my-score').textContent = score2048; }
    }

    // 9. КОЛЕСО И РАНДОМ
    const wheelData = {
        food: ["Пицца 🍕", "Суши 🍣", "Бургеры 🍔", "Паста 🍝", "Шаурма 🌯", "Салат 🥗"],
        activity: ["Кино 🎬", "Прогулка 🚶", "Дома 🏠", "Кафе ☕", "Игры 🎮", "Спорт 🏃"],
        movie: ["Комедия 😂", "Ужасы 👻", "Фантастика 🚀", "Драма 🎭", "Мультфильм 🧸", "Боевик 💥"]
    };
    const wheelColors = ["#ff9a9e", "#fecfef", "#a18cd1", "#fbc2eb", "#ffd1d1", "#d1d1ff"];
    let currentAngle = 0, isSpinning = false, wheelCanvas, ctx, currentWheelOptions = [];

    window.updateWheel = function() {
        const cat = document.getElementById('wheel-category').value;
        currentWheelOptions = wheelData[cat];
        drawWheel();
    }

    window.drawWheel = function() {
        wheelCanvas = document.getElementById('wheel'); if (!wheelCanvas) return;
        ctx = wheelCanvas.getContext('2d');
        const numOptions = currentWheelOptions.length; const arcSize = (2 * Math.PI) / numOptions; const centerX = wheelCanvas.width / 2; const centerY = wheelCanvas.height / 2; const radius = centerX;
        ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
        for (let i = 0; i < numOptions; i++) {
            const startAngle = i * arcSize + currentAngle; const endAngle = (i + 1) * arcSize + currentAngle;
            ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, startAngle, endAngle); ctx.fillStyle = wheelColors[i % wheelColors.length]; ctx.fill(); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
            ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(startAngle + arcSize / 2); ctx.textAlign = "right"; ctx.fillStyle = "#333"; ctx.font = "bold 14px -apple-system, sans-serif"; ctx.fillText(currentWheelOptions[i], radius - 20, 5); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI); ctx.fillStyle = "white"; ctx.fill();
    }

    window.spinWheel = function() {
        if (isSpinning) return; isSpinning = true;
        const btn = document.getElementById('spin-btn'); btn.disabled = true; btn.textContent = 'Крутится...'; document.getElementById('wheel-result').textContent = '';
        const spins = Math.floor(Math.random() * 3) + 3; const randomDegree = Math.random() * 360; const totalRotation = (spins * 360) + randomDegree;
        wheelCanvas.style.transform = `rotate(${totalRotation}deg)`;
        setTimeout(() => {
            isSpinning = false; btn.disabled = false; btn.textContent = 'Крутить ещё раз!';
            const normalizedAngle = (totalRotation % 360); const winningIndex = Math.floor(((360 - normalizedAngle + 90) % 360) / (360 / currentWheelOptions.length));
            document.getElementById('wheel-result').textContent = `Выпало: ${currentWheelOptions[winningIndex]}`;
            if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#ff9a9e', '#a18cd1'] });
            currentAngle += totalRotation * (Math.PI / 180);
        }, 4000);
    }

    // Генератор идей
    const ideasData = {
        date: ["Сходить в кино 🍿", "Погулять в парке 🌳", "Устроить пикник 🧺", "Посетить кафе ☕", "Пойти в музей 🖼️", "Покататься на велосипедах 🚲"],
        home: ["Посмотреть фильм 🎬", "Приготовить ужин 🍳", "Поиграть в настолки 🎲", "Сделать массаж 💆", "Устроить спа 🛁", "Потанцевать 💃"],
        gift: ["Цветы 💐", "Книга 📚", "Сладости 🍫", "Украшение 💍", "Свидание 🥂", "Сертификат 🎁"]
    };
    window.generateIdea = function() {
        const cat = document.getElementById('idea-category').value; const list = ideasData[cat];
        const box = document.getElementById('idea-box'); box.style.opacity = 0;
        setTimeout(() => {
            box.textContent = list[Math.floor(Math.random() * list.length)]; box.style.opacity = 1;
            if (typeof confetti === 'function') confetti({ particleCount: 30, spread: 40, origin: { y: 0.8 }, colors: ['#fbc2eb', '#a18cd1'] });
        }, 300);
    }

    // Уведомления
    function showToast(text) {
        const toast = document.getElementById('toast'); toast.textContent = text; toast.style.bottom = '80px';
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }
});