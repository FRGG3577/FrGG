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
        if (pageName === 'games') { 
            loadGameState(); 
            load2048Records(); 
            loadSnakeRecords(); 
            // Отрисовываем пустые сетки при входе
            render2048(); 
            drawSnakeBoard();
        }
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
        
        if (gameName === 'game2048') { load2048Records(); render2048(); }
        if (gameName === 'snake') { loadSnakeRecords(); drawSnakeBoard(); }
    }

    // 4. ПЛАНЫ (WISHLIST)
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

    // 6. ЗАПИСКИ
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
    let board2048 = Array(16).fill(0); let score2048 = 0;
    window.init2048 = function() { board2048 = Array(16).fill(0); score2048 = 0; document.getElementById('my-score').textContent = "0"; addRandomTile(); addRandomTile(); render2048(); }
    function addRandomTile() { const empty = board2048.map((v, i) => v === 0 ? i : null).filter(v => v !== null); if (empty.length > 0) { const randomIndex = empty[Math.floor(Math.random() * empty.length)]; board2048[randomIndex] = Math.random() < 0.9 ? 2 : 4; } }
    function render2048() { 
        const grid = document.getElementById('grid-2048'); if(!grid) return; 
        grid.innerHTML = ''; 
        board2048.forEach(val => { 
            const tile = document.createElement('div'); 
            tile.className = `tile-2048 ${val !== 0 ? 'tile-' + val : ''}`; 
            tile.textContent = val !== 0 ? val : ''; 
            grid.appendChild(tile); 
        }); 
    }
    window.saveScore2048 = function() { if (!currentUserId || score2048 === 0) return; fetch('/api/2048/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, score: score2048 }) }).then(() => { showToast("Рекорд сохранен!"); load2048Records(); }); }
    window.load2048Records = function() { fetch('/api/2048/records').then(res => res.json()).then(records => { const myRec = records.find(r => r.user_id === currentUserId); const partnerRec = records.find(r => r.user_id !== currentUserId); if(document.getElementById('my-score')) document.getElementById('my-score').textContent = myRec ? myRec.score : 0; if(document.getElementById('partner-score')) document.getElementById('partner-score').textContent = partnerRec ? partnerRec.score : 0; }); }
    
    let touchStartX = 0, touchStartY = 0;
    const grid2048 = document.getElementById('grid-2048');
    if(grid2048) {
        grid2048.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, {passive: true});
        grid2048.addEventListener('touchend', e => {
            const diffX = e.changedTouches[0].clientX - touchStartX; const diffY = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(diffX) > Math.abs(diffY)) { if (diffX > 30) move2048('right'); else if (diffX < -30) move2048('left'); }
            else { if (diffY > 30) move2048('down'); else if (diffY < -30) move2048('up'); }
        }, {passive: true});
    }
    
    function move2048(direction) {
        let moved = false;
        if (direction === 'left' || direction === 'right') {
            for (let r = 0; r < 4; r++) { let row = [board2048[r*4], board2048[r*4+1], board2048[r*4+2], board2048[r*4+3]]; if (direction === 'right') row.reverse(); let newRow = row.filter(v => v !== 0); for (let i = 0; i < newRow.length - 1; i++) { if (newRow[i] === newRow[i+1]) { newRow[i] *= 2; score2048 += newRow[i]; newRow[i+1] = 0; moved = true; } } newRow = newRow.filter(v => v !== 0); while (newRow.length < 4) newRow.push(0); if (direction === 'right') newRow.reverse(); for (let c = 0; c < 4; c++) board2048[r*4+c] = newRow[c]; }
        } else if (direction === 'up' || direction === 'down') {
             for (let c = 0; c < 4; c++) { let col = [board2048[c], board2048[c+4], board2048[c+8], board2048[c+12]]; if (direction === 'down') col.reverse(); let newCol = col.filter(v => v !== 0); for (let i = 0; i < newCol.length - 1; i++) { if (newCol[i] === newCol[i+1]) { newCol[i] *= 2; score2048 += newCol[i]; newCol[i+1] = 0; moved = true; } } newCol = newCol.filter(v => v !== 0); while (newCol.length < 4) newCol.push(0); if (direction === 'down') newCol.reverse(); for (let r = 0; r < 4; r++) board2048[r*4+c] = newCol[r]; }
        }
        if (moved) { addRandomTile(); render2048(); document.getElementById('my-score').textContent = score2048; }
    }

    // 9. ЗМЕЙКА
    const canvas = document.getElementById('snake-canvas');
    let ctxSnake = canvas ? canvas.getContext('2d') : null;
    let snake = [], dir = {}, food = {}, scoreSnake = 0, snakeInterval = null;
    const box = 15;

    function drawSnakeBoard() {
        if (!ctxSnake) return;
        ctxSnake.fillStyle = "#fdfdfd"; ctxSnake.fillRect(0, 0, canvas.width, canvas.height);
        // Рисуем сетку для красоты
        ctxSnake.strokeStyle = "#f0f0f0";
        for(let i=0; i<canvas.width; i+=box) {
            ctxSnake.beginPath(); ctxSnake.moveTo(i, 0); ctxSnake.lineTo(i, canvas.height); ctxSnake.stroke();
            ctxSnake.beginPath(); ctxSnake.moveTo(0, i); ctxSnake.lineTo(canvas.width, i); ctxSnake.stroke();
        }
    }

    window.startSnake = function() {
        if (!ctxSnake) return;
        snake = [{x: 9*box, y: 10*box}]; dir = {x: 0, y: 0}; food = getRandomFood(); scoreSnake = 0;
        document.getElementById('my-score-snake').textContent = "0";
        if (snakeInterval) clearInterval(snakeInterval);
        snakeInterval = setInterval(drawSnake, 150);
    }

    function getRandomFood() {
        return { x: Math.floor(Math.random() * 20) * box, y: Math.floor(Math.random() * 20) * box };
    }

    function drawSnake() {
        if (!ctxSnake) return;
        drawSnakeBoard();
        
        // Рисуем еду (яблочко)
        ctxSnake.fillStyle = "#ff9a9e"; ctxSnake.beginPath(); ctxSnake.arc(food.x + box/2, food.y + box/2, box/2 - 1, 0, Math.PI*2); ctxSnake.fill();

        // Двигаем змейку (если не стоим на месте)
        if (dir.x !== 0 || dir.y !== 0) {
            let headX = snake[0].x + dir.x; let headY = snake[0].y + dir.y;
            snake.unshift({x: headX, y: headY});

            if (headX === food.x && headY === food.y) { 
                scoreSnake++; 
                document.getElementById('my-score-snake').textContent = scoreSnake;
                food = getRandomFood(); 
            } else { 
                snake.pop(); 
            }

            // Проверка на столкновения
            if (headX < 0 || headX >= canvas.width || headY < 0 || headY >= canvas.height || snake.slice(1).some(s => s.x === headX && s.y === headY)) {
                clearInterval(snakeInterval); 
                showToast("Игра окончена! Счет: " + scoreSnake);
                return;
            }
        }

        // Рисуем змейку
        snake.forEach((s, i) => {
            ctxSnake.fillStyle = i === 0 ? "#a18cd1" : "#d1d1ff"; // Голова темнее
            ctxSnake.fillRect(s.x + 1, s.y + 1, box-2, box-2);
        });
    }

    // Управление змейкой
    window.changeDir = function(direction) {
        if (direction === 'up' && dir.y === 0) dir = {x: 0, y: -box};
        if (direction === 'down' && dir.y === 0) dir = {x: 0, y: box};
        if (direction === 'left' && dir.x === 0) dir = {x: -box, y: 0};
        if (direction === 'right' && dir.x === 0) dir = {x: box, y: 0};
    }

    document.addEventListener('keydown', e => {
        if (e.key === "ArrowUp") changeDir('up');
        if (e.key === "ArrowDown") changeDir('down');
        if (e.key === "ArrowLeft") changeDir('left');
        if (e.key === "ArrowRight") changeDir('right');
    });

    let snakeTouchX = 0, snakeTouchY = 0;
    if (canvas) {
        canvas.addEventListener('touchstart', e => { snakeTouchX = e.touches[0].clientX; snakeTouchY = e.touches[0].clientY; }, {passive: true});
        canvas.addEventListener('touchend', e => {
            const diffX = e.changedTouches[0].clientX - snakeTouchX; const diffY = e.changedTouches[0].clientY - snakeTouchY;
            if (Math.abs(diffX) > Math.abs(diffY)) { if (diffX > 20) changeDir('right'); else if (diffX < -20) changeDir('left'); }
            else { if (diffY > 20) changeDir('down'); else if (diffY < -20) changeDir('up'); }
        }, {passive: true});
    }

    window.saveScoreSnake = function() { if (!currentUserId || scoreSnake === 0) return; fetch('/api/snake/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, score: scoreSnake }) }).then(() => { showToast("Рекорд сохранен!"); loadSnakeRecords(); }); }
    window.loadSnakeRecords = function() { fetch('/api/snake/records').then(res => res.json()).then(records => { const myRec = records.find(r => r.user_id === currentUserId); const partnerRec = records.find(r => r.user_id !== currentUserId); if(document.getElementById('my-score-snake')) document.getElementById('my-score-snake').textContent = myRec ? myRec.score : 0; if(document.getElementById('partner-score-snake')) document.getElementById('partner-score-snake').textContent = partnerRec ? partnerRec.score : 0; }); }

    // 10. КОЛЕСО И РАНДОМ
    const wheelData = { food: ["Пицца 🍕", "Суши 🍣", "Бургеры 🍔", "Паста 🍝", "Шаурма 🌯", "Салат 🥗"], activity: ["Кино 🎬", "Прогулка 🚶", "Дома 🏠", "Кафе ☕", "Игры 🎮", "Спорт 🏃"], movie: ["Комедия 😂", "Ужасы 👻", "Фантастика 🚀", "Драма 🎭", "Мультфильм 🧸", "Боевик 💥"] };
    const wheelColors = ["#ff9a9e", "#fecfef", "#a18cd1", "#fbc2eb", "#ffd1d1", "#d1d1ff"];
    let currentAngle = 0, isSpinning = false, wheelCanvas, ctxWheel, currentWheelOptions = [];
    
    window.updateWheel = function() { const cat = document.getElementById('wheel-category').value; currentWheelOptions = wheelData[cat]; drawWheel(); }
    window.drawWheel = function() {
        wheelCanvas = document.getElementById('wheel'); if (!wheelCanvas) return; ctxWheel = wheelCanvas.getContext('2d');
        const numOptions = currentWheelOptions.length; const arcSize = (2 * Math.PI) / numOptions; const centerX = wheelCanvas.width / 2; const centerY = wheelCanvas.height / 2; const radius = centerX;
        ctxWheel.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
        for (let i = 0; i < numOptions; i++) { const startAngle = i * arcSize + currentAngle; const endAngle = (i + 1) * arcSize + currentAngle; ctxWheel.beginPath(); ctxWheel.moveTo(centerX, centerY); ctxWheel.arc(centerX, centerY, radius, startAngle, endAngle); ctxWheel.fillStyle = wheelColors[i % wheelColors.length]; ctxWheel.fill(); ctxWheel.strokeStyle = "white"; ctxWheel.lineWidth = 2; ctxWheel.stroke(); ctxWheel.save(); ctxWheel.translate(centerX, centerY); ctxWheel.rotate(startAngle + arcSize / 2); ctxWheel.textAlign = "right"; ctxWheel.fillStyle = "#333"; ctxWheel.font = "bold 14px -apple-system, sans-serif"; ctxWheel.fillText(currentWheelOptions[i], radius - 20, 5); ctxWheel.restore(); }
        ctxWheel.beginPath(); ctxWheel.arc(centerX, centerY, 15, 0, 2 * Math.PI); ctxWheel.fillStyle = "white"; ctxWheel.fill();
    }
    window.spinWheel = function() {
        if (isSpinning) return; isSpinning = true; const btn = document.getElementById('spin-btn'); btn.disabled = true; btn.textContent = 'Крутится...'; document.getElementById('wheel-result').textContent = '';
        const spins = Math.floor(Math.random() * 3) + 3; const randomDegree = Math.random() * 360; const totalRotation = (spins * 360) + randomDegree;
        wheelCanvas.style.transform = `rotate(${totalRotation}deg)`;
        setTimeout(() => { isSpinning = false; btn.disabled = false; btn.textContent = 'Крутить ещё раз!'; const normalizedAngle = (totalRotation % 360); const winningIndex = Math.floor(((360 - normalizedAngle + 90) % 360) / (360 / currentWheelOptions.length)); document.getElementById('wheel-result').textContent = `Выпало: ${currentWheelOptions[winningIndex]}`; if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#ff9a9e', '#a18cd1'] }); currentAngle += totalRotation * (Math.PI / 180); }, 4000);
    }
    const ideasData = { date: ["Сходить в кино 🍿", "Погулять в парке 🌳", "Устроить пикник 🧺", "Посетить кафе ☕", "Пойти в музей 🖼️", "Покататься на велосипедах 🚲"], home: ["Посмотреть фильм 🎬", "Приготовить ужин 🍳", "Поиграть в настолки 🎲", "Сделать массаж 💆", "Устроить спа 🛁", "Потанцевать 💃"], gift: ["Цветы 💐", "Книга 📚", "Сладости 🍫", "Украшение 💍", "Свидание 🥂", "Сертификат 🎁"] };
    window.generateIdea = function() { const cat = document.getElementById('idea-category').value; const list = ideasData[cat]; const box = document.getElementById('idea-box'); box.style.opacity = 0; setTimeout(() => { box.textContent = list[Math.floor(Math.random() * list.length)]; box.style.opacity = 1; if (typeof confetti === 'function') confetti({ particleCount: 30, spread: 40, origin: { y: 0.8 }, colors: ['#fbc2eb', '#a18cd1'] }); }, 300); }

    function showToast(text) { const toast = document.getElementById('toast'); toast.textContent = text; toast.style.bottom = '80px'; setTimeout(() => { toast.style.bottom = '-100px'; }, 3000); }
});