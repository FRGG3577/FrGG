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
    }).catch(err => console.log(err));

    // Счетчик дней
    fetch('/api/days').then(res => res.json()).then(data => {
        document.getElementById('days-count').textContent = data.days;
    });

    // Настроения
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
        if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff477e', '#ff7096'] });
        
        fetch('/api/ping', { method: 'POST' }).then(() => {
            showToast("Сигнал отправлен!");
            setTimeout(() => { btn.disabled = false; btn.textContent = '💖 Отправить сигнал'; }, 3000);
        });
    }

    // Навигация
    window.switchPage = function(pageName, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${pageName}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        element.classList.add('active');

        if (pageName === 'wishlist') loadWishlist();
        if (pageName === 'notes') loadNotes();
        if (pageName === 'events') loadEvents();
    }

    // Wishlist
    window.loadWishlist = function() {
        fetch('/api/wishlist').then(res => res.json()).then(items => {
            const list = document.getElementById('wish-list');
            list.innerHTML = '';
            items.forEach(item => {
                list.innerHTML += `<li><span>${item.text}</span><button class="delete-btn" onclick="deleteWish('${item.id}')">×</button></li>`;
            });
        });
    }

    window.addWish = function() {
        const input = document.getElementById('wish-input');
        if (!input.value.trim()) return;
        fetch('/api/wishlist', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: input.value })
        }).then(() => { input.value = ''; loadWishlist(); showToast("Добавлено!"); });
    }

    window.deleteWish = function(id) {
        fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' }).then(() => loadWishlist());
    }

    // Notes
    window.loadNotes = function() {
        fetch('/api/notes').then(res => res.json()).then(notes => {
            const list = document.getElementById('notes-list');
            list.innerHTML = '';
            notes.forEach(note => {
                list.innerHTML += `
                    <div style="background:rgba(255,249,196,0.9); padding:15px; border-radius:12px; margin-bottom:10px; text-align:left; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: input.value })
        }).then(() => { input.value = ''; loadNotes(); showToast("Записка оставлена!"); });
    }

    // Events
    window.loadEvents = function() {
        fetch('/api/events').then(res => res.json()).then(events => {
            const list = document.getElementById('events-list');
            list.innerHTML = '';
            const today = new Date(); today.setHours(0,0,0,0);

            if (events.length === 0) {
                list.innerHTML = '<p class="status-text">Пока нет событий.</p>';
                return;
            }

            events.forEach(event => {
                const eventDate = new Date(event.date);
                const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                
                let daysText = '', colorClass = 'color: #666;';
                if (daysLeft === 0) { daysText = 'Сегодня! 🎉'; colorClass = 'color: #ff477e; font-weight: bold;'; }
                else if (daysLeft === 1) { daysText = 'Завтра 🔥'; colorClass = 'color: #ff477e; font-weight: bold;'; }
                else if (daysLeft > 0) { daysText = `Через ${daysLeft} дн.`; if (daysLeft <= 3) colorClass = 'color: #ff7f00;'; }
                else { daysText = 'Прошло'; colorClass = 'color: #999; text-decoration: line-through;'; }

                const dateParts = event.date.split('-');
                const formatDate = `${dateParts[2]}.${dateParts[1]}`;

                list.innerHTML += `
                    <li style="border-left-color: ${daysLeft <= 3 && daysLeft >= 0 ? '#ff477e' : '#a18cd1'};">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 4px;">${event.text}</div>
                            <div style="font-size: 12px; color: #888;">${formatDate} — <span style="${colorClass}">${daysText}</span></div>
                        </div>
                        <button class="delete-btn" onclick="deleteEvent('${event.id}')">×</button>
                    </li>`;
            });
        });
    }

    window.addEvent = function() {
        const text = document.getElementById('event-input').value;
        const date = document.getElementById('date-input').value;
        if (!text.trim() || !date) return showToast("Заполните все поля!");
        
        fetch('/api/events', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, date: date })
        }).then(() => {
            document.getElementById('event-input').value = '';
            document.getElementById('date-input').value = '';
            loadEvents(); showToast("Событие добавлено!");
        });
    }

    window.deleteEvent = function(id) {
        fetch(`/api/events?id=${id}`, { method: 'DELETE' }).then(() => loadEvents());
    }

    // Toast
    function showToast(text) {
        const toast = document.getElementById('toast');
        toast.textContent = text; toast.style.bottom = '80px';
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }
});