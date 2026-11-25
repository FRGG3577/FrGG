// Ждем, пока загрузится страница
document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); 
    tg.expand();

    let currentUserId = null;

    // 1. Авторизация
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

    // 2. Счетчик дней
    fetch('/api/days')
        .then(res => res.json())
        .then(data => {
            document.getElementById('days-count').textContent = data.days;
        });

    // 3. Настроения
    window.loadMoods = function() {
        fetch('/api/get_moods').then(res => res.json()).then(moods => {
            const ids = Object.keys(moods);
            if (ids.length >= 2) {
                document.querySelector('#my-mood .mood-emoji').textContent = moods[ids[0]] || '😐';
                document.querySelector('#partner-mood .mood-emoji').textContent = moods[ids[1]] || '😐';
            }
        });
    }
    
    // Загружаем настроения при старте
    loadMoods();

    // 4. Установка настроения (вызывается из HTML)
    window.setMood = function(emoji) {
        document.querySelector('#my-mood .mood-emoji').textContent = emoji;
        fetch('/api/mood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, mood: emoji })
        }).then(() => loadMoods());
    }

    // 5. Сигнал с конфетти
    window.sendHug = function() {
        const btn = document.getElementById('hug-button');
        btn.disabled = true;
        btn.textContent = 'Отправлено! 💌';
        
        // Конфетти!
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ff477e', '#ff7096', '#ff85a1', '#fbb1bd', '#f9bec7']
            });
        }

        fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId })
        }).then(() => {
            showToast("Сигнал и комплимент отправлены!");
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = '💖 Отправить сигнал';
            }, 3000);
        });
    }

    // 6. Показ уведомлений
    function showToast(text) {
        const toast = document.getElementById('toast');
        toast.textContent = text;
        toast.style.bottom = '30px';
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }
});