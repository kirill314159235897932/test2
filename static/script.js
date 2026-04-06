// ============ НАСТРОЙКИ ============
const API_BASE_URL = 'https://rpg-backend-uch9.onrender.com';
const CHAT_WS_URL = 'wss://rpg-chat-1.onrender.com';

// ============ ПЕРЕМЕННЫЕ ============
let sessionId = null;
let player = null;
let currentLocation = "Стена Мария";
let inBattle = false;
let currentBattleId = null;
let reconnectAttempts = 0;

// Чат
let chatSocket = null;
let playerNameForChat = null;

// DOM элементы
const messagesDiv = document.getElementById('messages');
const buttonsPanel = document.getElementById('buttonsPanel');
const statsPanel = document.getElementById('statsPanel');
const gameInput = document.getElementById('gameInput');

// ============ ФУНКЦИИ СОХРАНЕНИЯ ============
function saveGameToLocal() {
    if (sessionId && player) {
        const saveData = { 
            sessionId: sessionId, 
            player: player, 
            currentLocation: currentLocation, 
            savedAt: new Date().toISOString() 
        };
        localStorage.setItem('rpg_save', JSON.stringify(saveData));
        console.log('✅ Игра сохранена, sessionId:', sessionId);
        return true;
    }
    return false;
}

function loadGameFromLocal() {
    const saved = localStorage.getItem('rpg_save');
    if (saved) {
        try {
            const saveData = JSON.parse(saved);
            sessionId = saveData.sessionId;
            player = saveData.player;
            currentLocation = saveData.currentLocation || player.location || "Стена Мария";
            playerNameForChat = player.name;
            console.log('📂 Загружено сохранение, sessionId:', sessionId);
            addMessage(`📂 Загрузка сохранения... С возвращением, ${player.name}!`, 'victory');
            updateStats();
            renderLocationButtons();
            
            // Проверяем, жива ли сессия на сервере
            checkSessionAlive();
            return true;
        } catch(e) { 
            console.error('Ошибка загрузки:', e);
            clearSave();
        }
    }
    return false;
}

function clearSave() {
    localStorage.removeItem('rpg_save');
    sessionId = null;
    player = null;
    playerNameForChat = null;
    currentLocation = "Стена Мария";
    inBattle = false;
    currentBattleId = null;
}

function deleteSave() {
    if (confirm('🗑️ Вы уверены, что хотите удалить сохранение? Прогресс будет потерян!')) {
        clearSave();
        addMessage(`🗑️ Сохранение удалено! Перезагрузите страницу чтобы начать заново.`, 'system');
        updateStats();
        renderLocationButtons();
    }
}

// Проверка жива ли сессия на сервере
async function checkSessionAlive() {
    if (!sessionId) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: 'stats' })
        });
        const data = await response.json();
        
        if (data.error && data.error.includes('Сессия не найдена')) {
            console.log('⚠️ Сессия устарела, нужно пересоздать персонажа');
            addMessage(`⚠️ Сессия на сервере устарела. Пожалуйста, создайте персонажа заново.`, 'error');
            clearSave();
            updateStats();
            renderLocationButtons();
            return false;
        }
        
        if (data.stats) {
            console.log('✅ Сессия активна');
            player = data.stats;
            updateStats();
            return true;
        }
        return true;
    } catch(e) {
        console.error('Ошибка проверки сессии:', e);
        return false;
    }
}

// ============ ФУНКЦИИ ИГРЫ ============
function addMessage(text, type = 'system') {
    const msg = document.createElement('div');
    msg.className = `message msg-${type}`;
    msg.innerHTML = text.replace(/\n/g, '<br>');
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateStats() {
    if (!player) {
        statsPanel.innerHTML = '<span class="stat">👤 Создайте персонажа</span><span class="stat">💾 Нет сохранения</span>';
        return;
    }
    statsPanel.innerHTML = `
        <span class="stat">👤 ${player.name}</span>
        <span class="stat">⭐ Ур.${player.level}</span>
        <span class="stat">❤️ ${player.health}/${player.max_health}</span>
        <span class="stat">⚡ ${player.energy}/${player.max_energy}</span>
        <span class="stat">💰 ${player.gold}</span>
        <span class="stat">🗡️ ${player.attack}</span>
        <span class="stat">🛡️ ${player.defense}</span>
        <span class="stat">🏃 ${player.agility}</span>
        <span class="stat">💾 Сохранено</span>
    `;
}

function renderLocationButtons() {
    const buttonsMap = {
        "Стена Мария": ["Стена Роза", "За стеной", "Казармы", "Торговый район", "Центральная площадь", "Дом Аккерманов", "stats", "inventory", "save_game", "delete_save"],
        "Стена Роза": ["Стена Мария", "Стена Сина", "Тренировочная площадка", "Госпиталь", "Лаборатория", "stats", "inventory", "save_game", "delete_save"],
        "Стена Сина": ["Стена Роза", "Королевский дворец", "Рынок Сины", "Храм воинов", "Госпиталь", "stats", "inventory", "save_game", "delete_save"],
        "За стеной": ["hunt", "explore", "Броня Титана", "Колоссальный титан", "Дракон", "stats", "save_game", "delete_save", "Назад"],
        "Казармы": ["train_odm", "train_normal", "buy_odm", "buy_gas", "buy_blades", "stats", "save_game", "delete_save", "Назад"],
        "Тренировочная площадка": ["train_odm", "train_normal", "stats", "save_game", "delete_save", "Назад"],
        "Торговый район": ["Магазин оружия", "Аптека", "Магазин ODM", "stats", "save_game", "delete_save", "Назад"],
        "Магазин оружия": ["buy_sword", "buy_shield", "stats", "save_game", "delete_save", "Назад"],
        "Аптека": ["buy_potion", "stats", "save_game", "delete_save", "Назад"],
        "Магазин ODM": ["buy_gas", "buy_blades", "stats", "save_game", "delete_save", "Назад"],
        "Центральная площадь": ["rest", "daily", "stats", "save_game", "delete_save", "Назад"],
        "Госпиталь": ["heal", "stats", "save_game", "delete_save", "Назад"],
        "Лаборатория": ["Сдать трофеи", "stats", "save_game", "delete_save", "Назад"],
        "Королевский дворец": ["Получить награду", "stats", "save_game", "delete_save", "Назад"],
        "Рынок Сины": ["Продать травы", "stats", "save_game", "delete_save", "Назад"],
        "Храм воинов": ["Благословение", "stats", "save_game", "delete_save", "Назад"],
        "Дом Аккерманов": ["talk_mikasa", "mikasa_status", "summon_mikasa", "stats", "save_game", "delete_save", "Назад"]
    };
    
    const actionNames = {
        "stats": "📊 Характеристики", "inventory": "🎒 Инвентарь", "save_game": "💾 Сохранить", "delete_save": "🗑️ Удалить сохранение",
        "hunt": "🎯 Охота на титанов", "explore": "🔍 Исследовать лес",
        "train_odm": "🎯 Тренировка с ODM", "train_normal": "💪 Без ODM",
        "buy_odm": "🛡️ Купить ODM (100g)", "buy_gas": "⛽ Купить газ (20g)", "buy_blades": "🔪 Купить лезвия (10g)",
        "buy_sword": "🗡️ Купить меч (50g)", "buy_shield": "🛡️ Купить щит (30g)", "buy_potion": "🧪 Зелье здоровья (20g)",
        "rest": "😴 Отдохнуть", "daily": "🎁 Ежедневная награда", "heal": "🏥 Лечиться (10g)",
        "talk_mikasa": "💬 Поговорить с Микасой", "mikasa_status": "📊 Статус Микасы", "summon_mikasa": "👥 Призвать Микасу",
        "Назад": "⬅️ Назад", "Стена Мария": "🏛️ Стена Мария", "Стена Роза": "🏛️ Стена Роза",
        "Стена Сина": "🏛️ Стена Сина", "За стеной": "🌲 За стену", "Казармы": "⚔️ Казармы",
        "Торговый район": "🛒 Торговый район", "Центральная площадь": "🏙️ Центральная площадь",
        "Тренировочная площадка": "🎯 Тренировочная площадка", "Госпиталь": "🏥 Госпиталь",
        "Лаборатория": "🔬 Лаборатория", "Королевский дворец": "👑 Королевский дворец",
        "Рынок Сины": "💰 Рынок Сины", "Храм воинов": "🛐 Храм воинов", "Магазин оружия": "⚔️ Магазин оружия",
        "Аптека": "❤️ Аптека", "Магазин ODM": "⚡ Магазин ODM", "Дом Аккерманов": "🏠 Дом Аккерманов",
        "Броня Титана": "🛡️ Броня Титана (10+)", "Колоссальный титан": "🔥 Колоссальный титан (20+)",
        "Дракон": "🐉 Дракон (30+)", "Получить награду": "🏆 Получить награду", "Продать травы": "🌿 Продать травы",
        "Благословение": "🙏 Благословение (50g)", "Сдать трофеи": "🎖️ Сдать трофеи"
    };
    
    const acts = buttonsMap[currentLocation] || ["Стена Мария", "stats", "save_game", "delete_save"];
    const grid = document.createElement('div');
    grid.className = 'button-grid';
    
    acts.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'game-btn';
        if (action === "hunt" || action.includes("Титан") || action.includes("Дракон")) btn.classList.add('btn-danger');
        if (action === "rest" || action === "heal") btn.classList.add('btn-warning');
        if (action === "delete_save") btn.classList.add('btn-danger');
        btn.textContent = actionNames[action] || action;
        btn.onclick = () => sendAction(action);
        grid.appendChild(btn);
    });
    
    buttonsPanel.innerHTML = '';
    buttonsPanel.appendChild(grid);
}

function renderBattleButtons() {
    const grid = document.createElement('div');
    grid.className = 'button-grid';
    const actions = ["battle_attack", "battle_heal", "battle_flee"];
    const names = {"battle_attack": "⚔️ Атаковать", "battle_heal": "❤️ Использовать зелье", "battle_flee": "🏃 Сбежать"};
    
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'game-btn btn-danger';
        btn.textContent = names[action];
        btn.onclick = () => sendAction(action);
        grid.appendChild(btn);
    });
    buttonsPanel.innerHTML = '';
    buttonsPanel.appendChild(grid);
}

async function sendAction(action) {
    if (action === "save_game") {
        if (sessionId && player) {
            saveGameToLocal();
            addMessage(`💾 Игра сохранена!`, 'victory');
        } else {
            addMessage(`❌ Нечего сохранять - создайте персонажа!`, 'error');
        }
        return;
    }
    
    if (action === "delete_save") {
        deleteSave();
        return;
    }
    
    if (!sessionId) {
        addMessage(`❌ Сначала создайте персонажа!`, 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: action, battle_id: currentBattleId })
        });
        const data = await response.json();
        
        if (data.error && data.error.includes('Сессия не найдена')) {
            addMessage(`⚠️ Сессия устарела. Пожалуйста, создайте персонажа заново.`, 'error');
            clearSave();
            updateStats();
            renderLocationButtons();
            return;
        }
        
        if (data.error) { addMessage(`❌ ${data.error}`, 'error'); return; }
        
        if (data.location) {
            currentLocation = data.location;
            addMessage(`📍 ${data.description || data.location}`, 'system');
            if (data.player) player = data.player;
            updateStats(); renderLocationButtons(); saveGameToLocal();
            return;
        }
        
        if (data.battle_start) {
            inBattle = true; currentBattleId = data.battle_id;
            addMessage(`⚔️ ВСТРЕЧА С ${data.enemy}!`, 'combat');
            addMessage(data.description, 'combat');
            if (data.weak_spot) addMessage(`🎯 Слабое место: ${data.weak_spot}`, 'combat');
            addMessage(`❤️ Ваше здоровье: ${data.player_health}`, 'combat');
            addMessage(`💀 Здоровье врага: ${data.enemy_health}/${data.enemy_max_health}`, 'combat');
            renderBattleButtons(); return;
        }
        
        if (data.victory) {
            inBattle = false; currentBattleId = null;
            addMessage(`🎉 ${data.message}`, 'victory');
            if (data.player) player = data.player;
            updateStats(); renderLocationButtons(); saveGameToLocal();
            return;
        }
        
        if (data.defeat) {
            inBattle = false; currentBattleId = null;
            addMessage(`💀 ${data.message}`, 'error');
            if (data.player) player = data.player;
            if (player) currentLocation = player.location || "Стена Мария";
            updateStats(); renderLocationButtons(); saveGameToLocal();
            return;
        }
        
        if (data.fled) {
            inBattle = false; currentBattleId = null;
            addMessage(`🏃 ${data.message}`, 'system');
            if (data.player) player = data.player;
            updateStats(); renderLocationButtons(); saveGameToLocal();
            return;
        }
        
        if (data.action === "attack" || data.action === "heal" || data.action === "flee_fail") {
            addMessage(data.message, 'combat');
            if (data.player_health) addMessage(`❤️ Ваше здоровье: ${data.player_health}`, 'combat');
            if (data.enemy_health) addMessage(`💀 Здоровье врага: ${data.enemy_health}/${data.enemy_max_health}`, 'combat');
            if (data.player) player = data.player;
            updateStats(); saveGameToLocal();
            return;
        }
        
        if (data.success) {
            addMessage(`✅ ${data.message}`, 'victory');
            if (data.player) player = data.player;
            updateStats(); saveGameToLocal();
            return;
        }
        
        if (data.stats) {
            const p = data.stats;
            addMessage(`📊 ХАРАКТЕРИСТИКИ ${p.name}\n❤️ Здоровье: ${p.health}/${p.max_health}\n⚡ Энергия: ${p.energy}/${p.max_energy}\n⭐ Уровень: ${p.level}\n📈 Опыт: ${p.exp}/${p.max_exp}\n⚔️ Атака: ${p.attack}\n🛡️ Защита: ${p.defense}\n🏃 Ловкость: ${p.agility}\n💰 Золото: ${p.gold}\n📍 Локация: ${p.location}`, 'system');
            return;
        }
        
        if (data.inventory) {
            let text = "🎒 ИНВЕНТАРЬ:\n";
            if (data.inventory.length === 0) text += "Пусто";
            else {
                const counts = {};
                data.inventory.forEach(item => counts[item] = (counts[item] || 0) + 1);
                for (const [item, count] of Object.entries(counts)) text += `• ${item}${count > 1 ? ` x${count}` : ''}\n`;
            }
            if (data.player) text += `\n⛽ Газ ODM: ${data.player.gas_level}/100\n🔪 Лезвия: ${data.player.blades_count}/6`;
            addMessage(text, 'system'); return;
        }
        
        if (data.mikasa_status) {
            const levelText = ["Незнакомец", "Знакомый", "Товарищ", "Друг", "Близкий друг", "Доверенное лицо"];
            addMessage(`❤️ ОТНОШЕНИЯ С МИКАСОЙ\nУровень: ${levelText[data.level]} (${data.level}/5)\nПрогресс: ${data.relationship}/100\nВ команде: ${data.has_companion ? "✅ Да" : "❌ Нет"}`, 'system');
            return;
        }
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}. Сервер: ${API_BASE_URL}`, 'error');
        console.error(error);
    }
}

async function createCharacter(name) {
    addMessage(`📡 Создание персонажа "${name}"...`, 'system');
    try {
        const response = await fetch(`${API_BASE_URL}/api/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (data.success) {
            sessionId = data.session_id;
            player = data.player;
            currentLocation = player.location;
            playerNameForChat = name;
            addMessage(`✨ Создан персонаж ${player.name}!`, 'victory');
            updateStats();
            renderLocationButtons();
            saveGameToLocal();
        } else {
            addMessage(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}. Сервер доступен? ${API_BASE_URL}`, 'error');
        console.error(error);
    }
}

// ============ ФУНКЦИИ ЧАТА ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addChatMessage(type, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const msg = document.createElement('div');
    msg.className = `chat-message ${type}`;
    msg.innerHTML = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    
    while (container.children.length > 100) {
        container.removeChild(container.firstChild);
    }
}

function connectChat() {
    chatSocket = new WebSocket(CHAT_WS_URL);
    
    chatSocket.onopen = () => {
        addChatMessage('system', '🔌 Подключено к чату!');
    };
    
    chatSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                addChatMessage('player', `<span class="name">${escapeHtml(data.name)}</span>: ${escapeHtml(data.text)} <span class="time">${data.time}</span>`);
            } else if (data.type === 'online') {
                const onlineSpan = document.getElementById('chatOnlineCount');
                if (onlineSpan) onlineSpan.innerText = `(${data.count})`;
            }
        } catch(e) { console.error(e); }
    };
    
    chatSocket.onerror = () => {
        addChatMessage('system', '⚠️ Ошибка подключения к чату');
    };
    
    chatSocket.onclose = () => {
        addChatMessage('system', '🔌 Отключено от чата. Переподключение...');
        setTimeout(connectChat, 5000);
    };
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        addChatMessage('system', '❌ Чат не подключён');
        return;
    }
    if (!playerNameForChat && player) {
        playerNameForChat = player.name;
    }
    if (!playerNameForChat) {
        addChatMessage('system', '❌ Сначала создайте персонажа');
        return;
    }
    
    chatSocket.send(JSON.stringify({
        name: playerNameForChat,
        text: text.substring(0, 100)
    }));
    input.value = '';
}

function toggleChat() {
    const window = document.getElementById('chatWindow');
    if (window) window.classList.toggle('collapsed');
}

// ============ ПРЕДОТВРАЩАЕМ ЗАСЫПАНИЕ СЕРВЕРА (KEEP-ALIVE) ============
let lastPing = 0;

async function keepAlive() {
    const now = Date.now();
    if (now - lastPing < 540000) return; // раз в 9 минут
    
    lastPing = now;
    console.log('🔄 Пинг сервера...');
    
    try {
        // Пинг бэкенда
        await fetch(`${API_BASE_URL}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stats', session_id: sessionId })
        }).catch(() => {});
        
        // Пинг чата
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(JSON.stringify({ type: 'ping' }));
        } else if (chatSocket && chatSocket.readyState !== WebSocket.OPEN) {
            connectChat();
        }
        
        console.log('✅ Пинг успешен');
    } catch(e) {
        console.log('Пинг не удался:', e);
    }
}

// Запускаем keep-alive
setInterval(keepAlive, 540000);
setTimeout(keepAlive, 60000);
console.log('🔄 Keep-alive активирован (пинг каждые 9 минут)');

// ============ ЗАПУСК ============
gameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = gameInput.value.trim();
        if (name && !sessionId && !player) {
            createCharacter(name);
            gameInput.value = '';
            gameInput.placeholder = "Введите команду...";
        } else if (name && sessionId) {
            addMessage(`✅ Персонаж уже создан! Используйте кнопки меню.`, 'system');
            gameInput.value = '';
        }
    }
});

if (!loadGameFromLocal()) {
    renderLocationButtons();
    addMessage(`🖥️ Сервер: ${API_BASE_URL}`, 'system');
    addMessage(`🖱️ Введите имя персонажа и нажмите Enter`, 'system');
    addMessage(`💾 Игра будет автоматически сохраняться`, 'system');
} else {
    addMessage(`💾 Автосохранение включено`, 'system');
}

// Подключаем чат
setTimeout(() => {
    connectChat();
}, 1000);
