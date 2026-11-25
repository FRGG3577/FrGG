document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); tg.expand();

    let currentUserId = null;

    // Авторизация
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
    });

    // Главная: счетчик дней
    fetch('/api/days').then(res => res.json()).then(data => {
        document.getElementById('days-count').textContent = data.days;
    });

    // Главная: настроения
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
        fetch('/api/ping', { method: 'POST' }).then(() => {
            showToast("Сигнал отправлен!");
            setTimeout(() => { btn.disabled = false; btn.textContent = '💖 Отправить сигнал'; }, 3000);
        });
    }

    // --- НАВИГАЦИЯ ---
    window.switchPage = function(pageName, element) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Показываем нужную
        document.getElementById(`page-${pageName}`).classList.add('active');
        
        // Обновляем активный таб
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        element.classList.add('active');

        // Загружаем данные при переходе
        if (pageName === 'wishlist') loadWishlist();
        if (pageName === 'notes') loadNotes();
    }

    // --- WISHLIST ---
    window.loadWishlist = function() {
        fetch('/api/wishlist').then(res => res.json()).then(items => {
            const list = document.getElementById('wish-list');
            list.innerHTML = '';
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

    // --- NOTES ---
    window.loadNotes = function() {
        fetch('/api/notes').then(res => res.json()).then(notes => {
            const list = document.getElementById('notes-list');
            list.innerHTML = '';
            // Выводим в обратном порядке (новые сверху)
            notes.reverse().forEach(note => {
                list.innerHTML += `
                    <div class="note-item" style="background:#fff9c4; padding:15px; border-radius:12px; margin-bottom:10px; text-align:left; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
                        <p style="margin:0; font-size:15px;">${note.text}</p>
                        <small style="color:#999; font-size:11px;">${note.date}</small>
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

    // --- TOAST ---
    function showToast(text) {
        const toast = document.getElementById('toast');
        toast.textContent = text;
        toast.style.bottom = '80px'; // Чуть выше меню
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }
});