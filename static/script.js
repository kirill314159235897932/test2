// ============ НАСТРОЙКИ ============
const API_BASE_URL = 'https://rpg-backend-uch9.onrender.com';
const CHAT_WS_URL = 'wss://rpg-chat-1.onrender.com';

// ============ ПЕРЕМЕННЫЕ ============
let sessionId = null;
let player = null;
let currentLocation = "Стена Мария";
let inBattle = false;
let currentBattleId = null;
let chatSocket = null;
let playerNameForChat = null;
let lastRestTime = null;
let lastDailyTime = null;
let lastTrainingTime = null;
let lastDiceTime = null;
let playerDiamonds = 0;
let currentPrivilege = null;

// DOM элементы
const messagesDiv = document.getElementById('messages');
const buttonsPanel = document.getElementById('buttonsPanel');
const statsPanel = document.getElementById('statsPanel');
const gameInput = document.getElementById('gameInput');

// ============ СОХРАНЕНИЕ ============
function saveGameToLocal() {
    if (sessionId && player) {
        localStorage.setItem('rpg_save', JSON.stringify({ sessionId, player, currentLocation }));
        addMessage(`💾 Игра сохранена!`, 'victory');
    }
}

function loadGameFromLocal() {
    const saved = localStorage.getItem('rpg_save');
    if (saved) {
        const saveData = JSON.parse(saved);
        sessionId = saveData.sessionId;
        player = saveData.player;
        currentLocation = saveData.currentLocation || player.location || "Стена Мария";
        playerNameForChat = player.name;
        addMessage(`📂 Загрузка сохранения... С возвращением, ${player.name}!`, 'victory');
        updateStats();
        renderLocationButtons();
        setTimeout(() => { addShopButton(); updateDiamonds(); updateChatPrivilege(); }, 500);
        return true;
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
    if (confirm('🗑️ Удалить сохранение?')) {
        clearSave();
        addMessage(`🗑️ Сохранение удалено!`, 'system');
        updateStats();
        renderLocationButtons();
    }
}

// ============ ИГРА ============
function addMessage(text, type = 'system') {
    const msg = document.createElement('div');
    msg.className = `message msg-${type}`;
    msg.innerHTML = text.replace(/\n/g, '<br>');
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateStats() {
    if (!player) {
        statsPanel.innerHTML = '<span class="stat">👤 Создайте персонажа</span>';
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
    `;
}

function renderLocationButtons() {
    const buttonsMap = {
        "Стена Мария": ["Стена Роза", "За стеной", "Казармы", "Торговый район", "Центральная площадь", "Дом Аккерманов", "stats", "inventory", "save_game", "delete_save"],
        "Стена Роза": ["Стена Мария", "Стена Сина", "Тренировочная площадка", "Госпиталь", "Лаборатория", "stats", "inventory", "save_game", "delete_save"],
        "Стена Сина": ["Стена Роза", "Королевский дворец", "Рынок Сины", "Храм воинов", "Госпиталь", "stats", "inventory", "save_game", "delete_save"],
        "За стеной": ["hunt", "explore", "Боссы", "stats", "save_game", "delete_save", "Назад"],
        "Казармы": ["Взять задание", "Улучшить ODM", "buy_odm", "buy_gas", "buy_blades", "stats", "save_game", "delete_save", "Назад"],
        "Тренировочная площадка": ["train_odm", "train_normal", "stats", "save_game", "delete_save", "Назад"],
        "Торговый район": ["Магазин оружия", "Аптека", "Магазин ODM", "Черный рынок", "stats", "save_game", "delete_save", "Назад"],
        "Магазин оружия": ["buy_sword", "buy_shield", "buy_bow", "buy_crossbow", "stats", "save_game", "delete_save", "Назад"],
        "Аптека": ["buy_potion", "buy_big_potion", "buy_herbs", "buy_antidote", "stats", "save_game", "delete_save", "Назад"],
        "Магазин ODM": ["buy_gas", "buy_blades", "buy_battery", "buy_repair_kit", "stats", "save_game", "delete_save", "Назад"],
        "Черный рынок": ["buy_artifact", "buy_gem", "buy_treasure_map", "buy_magic_crystal", "stats", "save_game", "delete_save", "Назад"],
        "Центральная площадь": ["rest", "talk_citizens", "Таверна", "daily", "stats", "save_game", "delete_save", "Назад"],
        "Таверна": ["play_dice", "gossip", "drink_beer", "stats", "save_game", "delete_save", "Назад"],
        "Госпиталь": ["heal", "buy_medicine", "stats", "save_game", "delete_save", "Назад"],
        "Лаборатория": ["submit_trophies", "study_artifacts", "stats", "save_game", "delete_save", "Назад"],
        "Королевский дворец": ["get_titan_reward", "get_title", "stats", "save_game", "delete_save", "Назад"],
        "Рынок Сины": ["sell_herbs", "sell_trophies", "buy_rare_components", "stats", "save_game", "delete_save", "Назад"],
        "Храм воинов": ["get_blessing", "meditate", "donate", "stats", "save_game", "delete_save", "Назад"],
        "Дом Аккерманов": ["talk_mikasa", "train_with_mikasa", "invite_mikasa", "give_gift", "mikasa_status", "stats", "save_game", "delete_save", "Назад"],
        "Боссы": ["Броня Титана", "Колоссальный титан", "Дракон", "stats", "save_game", "delete_save", "Назад"]
    };
    
    const actionNames = {
        "stats": "📊 Характеристики", "inventory": "🎒 Инвентарь", "save_game": "💾 Сохранить", "delete_save": "🗑️ Удалить сохранение",
        "hunt": "🎯 Охота на титанов", "explore": "🔍 Исследовать лес", "Боссы": "⚔️ Боссы",
        "Броня Титана": "🛡️ Броня Титана (10+)", "Колоссальный титан": "🔥 Колоссальный титан (20+)", "Дракон": "🐉 Дракон (30+)",
        "train_odm": "🎯 Тренировка с ODM", "train_normal": "💪 Без ODM",
        "buy_odm": "🛡️ Купить ODM (100g)", "buy_gas": "⛽ Купить газ (20g)", "buy_blades": "🔪 Купить лезвия (10g)",
        "buy_battery": "⚡ Батарея ODM (50g)", "buy_repair_kit": "🔧 Ремкомплект (30g)",
        "buy_sword": "🗡️ Купить меч (50g)", "buy_shield": "🛡️ Купить щит (30g)", "buy_bow": "🏹 Купить лук (70g)", "buy_crossbow": "🎯 Купить арбалет (100g)",
        "buy_potion": "🧪 Зелье здоровья (20g)", "buy_big_potion": "⚗️ Большое зелье (40g)", "buy_herbs": "🌿 Лечебные травы (10g)", "buy_antidote": "💊 Антидот (25g)",
        "buy_artifact": "🎖️ Редкий артефакт (200g)", "buy_gem": "💎 Драгоценный камень (150g)", "buy_treasure_map": "📜 Карта сокровищ (100g)", "buy_magic_crystal": "🔮 Магический кристалл (300g)",
        "rest": "😴 Отдохнуть", "talk_citizens": "🗣️ Поговорить с горожанами", "Таверна": "🍺 Таверна", "daily": "🎁 Ежедневная награда",
        "play_dice": "🎲 Сыграть в кости (10g)", "gossip": "🗣️ Узнать сплетни", "drink_beer": "🍺 Выпить эля (5g)",
        "heal": "🏥 Лечиться (10g)", "buy_medicine": "💊 Купить медикаменты",
        "submit_trophies": "🎖️ Сдать трофеи", "study_artifacts": "🔍 Изучить артефакты",
        "get_titan_reward": "🏆 Получить награду за титанов", "get_title": "🎖️ Получить титул",
        "sell_herbs": "🌿 Продать травы (5g/шт)", "sell_trophies": "🎖️ Продать трофеи", "buy_rare_components": "⚗️ Купить редкие компоненты",
        "get_blessing": "🙏 Получить благословение (50g)", "meditate": "🧘 Медитировать", "donate": "💰 Пожертвовать (100g)",
        "talk_mikasa": "💬 Поговорить с Микасой", "train_with_mikasa": "⚔️ Тренироваться вместе", "invite_mikasa": "👥 Пригласить в команду", "give_gift": "🎁 Подарить подарок", "mikasa_status": "📊 Статус Микасы",
        "Взять задание": "📜 Взять задание", "Назад": "⬅️ Назад",
        "Стена Мария": "🏛️ Стена Мария", "Стена Роза": "🏛️ Стена Роза", "Стена Сина": "🏛️ Стена Сина",
        "За стеной": "🌲 За стену", "Казармы": "⚔️ Казармы", "Торговый район": "🛒 Торговый район",
        "Центральная площадь": "🏙️ Центральная площадь", "Тренировочная площадка": "🎯 Тренировочная площадка",
        "Госпиталь": "🏥 Госпиталь", "Лаборатория": "🔬 Лаборатория", "Королевский дворец": "👑 Королевский дворец",
        "Рынок Сины": "💰 Рынок Сины", "Храм воинов": "🛐 Храм воинов", "Магазин оружия": "⚔️ Магазин оружия",
        "Аптека": "❤️ Аптека", "Магазин ODM": "⚡ Магазин ODM", "Черный рынок": "🛒 Черный рынок",
        "Дом Аккерманов": "🏠 Дом Аккерманов"
    };
    
    const acts = buttonsMap[currentLocation] || ["Стена Мария", "stats", "save_game", "delete_save"];
    const grid = document.createElement('div');
    grid.className = 'button-grid';
    
    acts.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'game-btn';
        if (action === "hunt" || action.includes("Титан") || action.includes("Дракон") || action === "Боссы") btn.classList.add('btn-danger');
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
    ["battle_attack", "battle_heal", "battle_flee"].forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'game-btn btn-danger';
        btn.textContent = {"battle_attack": "⚔️ Атаковать", "battle_heal": "❤️ Использовать зелье", "battle_flee": "🏃 Сбежать"}[action];
        btn.onclick = () => sendAction(action);
        grid.appendChild(btn);
    });
    buttonsPanel.innerHTML = '';
    buttonsPanel.appendChild(grid);
}

async function sendAction(action) {
    const locationNames = ["Стена Мария", "Стена Роза", "Стена Сина", "За стеной", "Казармы", "Тренировочная площадка", "Торговый район", "Магазин оружия", "Аптека", "Магазин ODM", "Черный рынок", "Центральная площадь", "Таверна", "Госпиталь", "Лаборатория", "Королевский дворец", "Рынок Сины", "Храм воинов", "Дом Аккерманов", "Боссы"];
    
    if (locationNames.includes(action)) {
        currentLocation = action;
        addMessage(`📍 Переход в ${action}`, 'system');
        renderLocationButtons();
        if (player) { player.location = action; saveGameToLocal(); }
        return;
    }
    
    if (action === "Назад") {
        if (currentLocation === "Боссы") currentLocation = "За стеной";
        else if (["Магазин оружия", "Аптека", "Магазин ODM", "Черный рынок"].includes(currentLocation)) currentLocation = "Торговый район";
        else if (currentLocation === "Таверна") currentLocation = "Центральная площадь";
        else if (["Лаборатория", "Королевский дворец", "Рынок Сины", "Храм воинов"].includes(currentLocation)) currentLocation = "Стена Сина";
        else if (currentLocation === "Госпиталь") currentLocation = "Стена Роза";
        else currentLocation = "Стена Мария";
        addMessage(`📍 Возврат в ${currentLocation}`, 'system');
        renderLocationButtons();
        if (player) { player.location = currentLocation; saveGameToLocal(); }
        return;
    }
    
    if (action === "save_game") { if (sessionId && player) saveGameToLocal(); else addMessage(`❌ Создайте персонажа!`, 'error'); return; }
    if (action === "delete_save") { deleteSave(); return; }
    
    if (action === "rest") {
        if (!lastRestTime || Date.now() - lastRestTime > 300000) {
            if (player) { player.health = player.max_health; player.energy = player.max_energy; if (player.odm_gear) { player.gas_level = 100; player.blades_count = 6; } }
            lastRestTime = Date.now();
            addMessage(`😴 Отдохнули!`, 'victory');
            updateStats(); saveGameToLocal();
        } else addMessage(`⏳ Отдых через ${Math.ceil((300000 - (Date.now() - lastRestTime)) / 60000)} мин`, 'error');
        return;
    }
    
    if (action === "daily") {
        if (!lastDailyTime || Date.now() - lastDailyTime > 86400000) {
            if (player) { const reward = Math.floor(Math.random() * 100) + 50; player.gold += reward; }
            lastDailyTime = Date.now();
            addMessage(`🎁 Ежедневная награда! +${reward} золота`, 'victory');
            updateStats(); saveGameToLocal();
        } else addMessage(`⏳ Награда через ${Math.ceil((86400000 - (Date.now() - lastDailyTime)) / 3600000)} часов`, 'error');
        return;
    }
    
    if (action === "heal" && player && player.gold >= 10) {
        player.gold -= 10;
        player.health = player.max_health;
        addMessage(`🏥 Вылечены!`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    if (action === "talk_citizens") {
        addMessage(`🗣️ ${["Горожанин: 'Титаны становятся все опаснее...'", "Горожанин: 'Разведкорпус готовит новую экспедицию.'", "Горожанин: 'Береги себя за стеной!'"][Math.floor(Math.random() * 3)]}`, 'system');
        return;
    }
    
    if (action === "play_dice" && player && player.gold >= 10) {
        if (lastDiceTime && Date.now() - lastDiceTime < 5000) { addMessage(`⏳ Подождите 5 секунд!`, 'error'); return; }
        player.gold -= 10;
        const playerDice = Math.floor(Math.random() * 6) + 1;
        const tavernDice = Math.floor(Math.random() * 6) + 1;
        lastDiceTime = Date.now();
        if (playerDice > tavernDice) { const win = Math.floor(Math.random() * 15) + 10; player.gold += win; addMessage(`🎲 ВЫИГРАЛИ! +${win} золота`, 'victory'); }
        else if (playerDice < tavernDice) addMessage(`🎲 ПРОИГРАЛИ! -10 золота`, 'error');
        else { player.gold += 5; addMessage(`🎲 НИЧЬЯ! +5 золота`, 'system'); }
        updateStats(); saveGameToLocal();
        return;
    }
    
    if (action === "gossip") {
        addMessage(`🗣️ ${["Говорят, что в лесу видели странного титана...", "Шепчутся, что кто-то нашел древний артефакт.", "Королевский дворец готовит большую экспедицию."][Math.floor(Math.random() * 3)]}`, 'system');
        return;
    }
    
    if (action === "drink_beer" && player && player.gold >= 5) {
        player.gold -= 5;
        player.energy = Math.min(player.max_energy, player.energy + 10);
        addMessage(`🍺 Энергия +10`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    if (!sessionId) { addMessage(`❌ Создайте персонажа!`, 'error'); return; }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: action, battle_id: currentBattleId })
        });
        const data = await response.json();
        
        if (data.error && data.error.includes('Сессия не найдена')) { addMessage(`⚠️ Сессия устарела. Создайте нового персонажа.`, 'error'); clearSave(); updateStats(); renderLocationButtons(); return; }
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
        
        if (data.victory || data.defeat || data.fled) {
            inBattle = false; currentBattleId = null;
            addMessage(data.victory ? `🎉 ${data.message}` : (data.defeat ? `💀 ${data.message}` : `🏃 ${data.message}`), data.victory ? 'victory' : (data.defeat ? 'error' : 'system'));
            if (data.player) player = data.player;
            if (player && data.defeat) currentLocation = player.location || "Стена Мария";
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
        
        if (data.success) { addMessage(`✅ ${data.message}`, 'victory'); if (data.player) player = data.player; updateStats(); saveGameToLocal(); return; }
        if (data.stats) { const p = data.stats; addMessage(`📊 ХАРАКТЕРИСТИКИ ${p.name}\n❤️ Здоровье: ${p.health}/${p.max_health}\n⚡ Энергия: ${p.energy}/${p.max_energy}\n⭐ Уровень: ${p.level}\n📈 Опыт: ${p.exp}/${p.max_exp}\n⚔️ Атака: ${p.attack}\n🛡️ Защита: ${p.defense}\n🏃 Ловкость: ${p.agility}\n💰 Золото: ${p.gold}\n📍 Локация: ${p.location}`, 'system'); return; }
        if (data.inventory) { let text = "🎒 ИНВЕНТАРЬ:\n"; if (data.inventory.length === 0) text += "Пусто"; else { const counts = {}; data.inventory.forEach(item => counts[item] = (counts[item] || 0) + 1); for (const [item, count] of Object.entries(counts)) text += `• ${item}${count > 1 ? ` x${count}` : ''}\n`; } if (data.player) text += `\n⛽ Газ ODM: ${data.player.gas_level}/100\n🔪 Лезвия: ${data.player.blades_count}/6`; addMessage(text, 'system'); return; }
        if (data.mikasa_status) { addMessage(`❤️ ОТНОШЕНИЯ С МИКАСОЙ\nУровень: ${["Незнакомец","Знакомый","Товарищ","Друг","Близкий друг","Доверенное лицо"][data.level]} (${data.level}/5)\nПрогресс: ${data.relationship}/100\nВ команде: ${data.has_companion ? "✅ Да" : "❌ Нет"}`, 'system'); return; }
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}`, 'error');
    }
}

async function createCharacter(name) {
    addMessage(`📡 Создание персонажа "${name}"...`, 'system');
    try {
        const response = await fetch(`${API_BASE_URL}/api/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) });
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
            addShopButton();
            await updateDiamonds();
            await updateChatPrivilege();
        } else addMessage(`❌ ${data.error}`, 'error');
    } catch (error) { addMessage(`❌ Ошибка: ${error.message}`, 'error'); }
}

// ============ ЧАТ ============
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
    while (container.children.length > 100) container.removeChild(container.firstChild);
}

function connectChat() {
    chatSocket = new WebSocket(CHAT_WS_URL);
    chatSocket.onopen = () => addChatMessage('system', '🔌 Подключено к чату!');
    chatSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                addChatMessage('player', `<span class="name">${data.name}</span>: ${escapeHtml(data.text)} <span class="time">${data.time}</span>`);
            } else if (data.type === 'online') {
                const onlineSpan = document.getElementById('chatOnlineCount');
                if (onlineSpan) onlineSpan.innerText = `(${data.count})`;
            }
        } catch(e) { console.error(e); }
    };
    chatSocket.onerror = () => addChatMessage('system', '⚠️ Ошибка подключения к чату');
    chatSocket.onclose = () => {
        addChatMessage('system', '🔌 Отключено от чата. Переподключение...');
        setTimeout(connectChat, 5000);
    };
    setTimeout(() => { if (playerNameForChat) updateChatPrivilege(); }, 2000);
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) { addChatMessage('system', '❌ Чат не подключён'); return; }
    if (!playerNameForChat && player) playerNameForChat = player.name;
    if (!playerNameForChat) { addChatMessage('system', '❌ Сначала создайте персонажа'); return; }
    chatSocket.send(JSON.stringify({ name: playerNameForChat, text: text.substring(0, 100) }));
    input.value = '';
}

function toggleChat() {
    document.getElementById('chatWindow').classList.toggle('collapsed');
}

// ============ ДОНАТ ============
async function updateDiamonds() {
    if (!sessionId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/diamonds/get`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) });
        const data = await response.json();
        playerDiamonds = data.diamonds || 0;
        let ds = document.getElementById('diamondsDisplay');
        if (!ds && player) {
            ds = document.createElement('span');
            ds.id = 'diamondsDisplay';
            ds.className = 'stat';
            document.getElementById('statsPanel').appendChild(ds);
        }
        if (ds) ds.innerHTML = `💎 ${playerDiamonds}`;
    } catch(e) { console.error(e); }
}

async function showPrivilegeShop() {
    const res = await fetch(`${API_BASE_URL}/api/privileges/list`);
    const privileges = (await res.json()).privileges;
    const html = `<div id="shopModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:1001; display:flex; justify-content:center; align-items:center;"><div style="background:#1a1a2e; border-radius:20px; padding:20px; max-width:450px; width:90%; border:2px solid #ffd700;"><h2 style="color:#ffd700; text-align:center;">💎 МАГАЗИН ПРИВИЛЕГИЙ</h2><p style="color:#aaa; text-align:center;">Ваши алмазы: <span style="color:#ffd700; font-size:1.5rem;">💎 ${playerDiamonds}</span></p><hr>${Object.entries(privileges).map(([id, p]) => `<div class="shop-item" data-id="${id}" style="background:#2c2c3e; margin:10px 0; padding:15px; border-radius:15px; cursor:pointer;"><div style="display:flex; justify-content:space-between;"><div><div style="font-size:1.2rem;">${p.name}</div><div style="font-size:0.8rem; color:#aaa;">на ${p.duration} дней</div></div><div style="color:#ffd700;">💎 ${p.price}</div></div></div>`).join('')}<hr><button id="addDiamondsBtn" style="width:100%; margin:10px 0; padding:12px; background:linear-gradient(135deg,#ffd700,#ffaa00); border:none; border-radius:10px; cursor:pointer; font-weight:bold;">💎 ПОПОЛНИТЬ АЛМАЗЫ</button><button id="closeShopModal" style="width:100%; margin-top:10px; padding:10px; background:#2c2c3e; border:1px solid #ff4444; color:#ff8888; border-radius:10px; cursor:pointer;">Закрыть</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.querySelectorAll('.shop-item').forEach(item => item.addEventListener('click', async () => { await buyPrivilege(item.dataset.id); }));
    document.getElementById('addDiamondsBtn').onclick = () => { document.getElementById('shopModal').remove(); showDonateOptions(); };
    document.getElementById('closeShopModal').onclick = () => document.getElementById('shopModal').remove();
}

async function showDonateOptions() {
    const html = `<div id="donateModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:1001; display:flex; justify-content:center; align-items:center;"><div style="background:#1a1a2e; border-radius:20px; padding:20px; max-width:400px; width:90%; border:2px solid #ffd700;"><h2 style="color:#ffd700; text-align:center;">💎 ПОПОЛНИТЬ АЛМАЗЫ</h2><p style="color:#aaa; text-align:center;">Выберите сумму:</p>${[{rub:100,diamonds:100,bonus:"0%"},{rub:300,diamonds:330,bonus:"+10%"},{rub:500,diamonds:600,bonus:"+20%"},{rub:1000,diamonds:1300,bonus:"+30%"}].map(opt => `<div class="donate-option" data-rub="${opt.rub}" style="background:#2c2c3e; margin:10px; padding:15px; border-radius:15px; cursor:pointer;"><div style="display:flex; justify-content:space-between;"><div><span style="font-size:1.2rem;">${opt.rub} ₽</span><div style="font-size:0.8rem; color:#88ff88;">${opt.bonus} бонус</div></div><div style="color:#ffd700;">💎 ${opt.diamonds}</div></div></div>`).join('')}<button id="closeDonateModal" style="width:100%; margin-top:15px; padding:10px; background:#2c2c3e; border:1px solid #ff4444; color:#ff8888; border-radius:10px; cursor:pointer;">Назад</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.querySelectorAll('.donate-option').forEach(opt => opt.addEventListener('click', async () => { await createDonation(parseInt(opt.dataset.rub)); }));
    document.getElementById('closeDonateModal').onclick = () => { document.getElementById('donateModal').remove(); showPrivilegeShop(); };
}

async function createDonation(amount) {
    addMessage(`💎 Создание платежа на ${amount} ₽...`, 'system');
    try {
        const response = await fetch(`${API_BASE_URL}/api/donate/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, amount: amount }) });
        const data = await response.json();
        if (data.success) {
            addMessage(`✅ Платёж создан!`, 'victory');
            if (confirm('Имитировать оплату?')) {
                const testRes = await fetch(`${API_BASE_URL}/api/donate/test/${data.donation_id}`);
                const testData = await testRes.json();
                if (testData.success) { addMessage(`✨ ${testData.message}`, 'victory'); await updateDiamonds(); }
            } else window.open(data.donation_url, '_blank');
            document.getElementById('donateModal')?.remove();
        } else addMessage(`❌ ${data.error}`, 'error');
    } catch(e) { addMessage(`❌ Ошибка: ${e.message}`, 'error'); }
}

async function buyPrivilege(privilegeType) {
    addMessage(`💎 Покупка привилегии...`, 'system');
    try {
        const response = await fetch(`${API_BASE_URL}/api/privileges/buy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, privilege_type: privilegeType }) });
        const data = await response.json();
        if (data.success) {
            addMessage(`✅ ${data.message}`, 'victory');
            playerDiamonds = data.diamonds;
            updateDiamondsDisplay();
            await updateChatPrivilege();
            document.getElementById('shopModal')?.remove();
        } else addMessage(`❌ ${data.error}`, 'error');
    } catch(e) { addMessage(`❌ Ошибка: ${e.message}`, 'error'); }
}

async function updateChatPrivilege() {
    if (!playerNameForChat) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/privileges/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, player_name: playerNameForChat }) });
        const data = await response.json();
        if (data.privilege && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(JSON.stringify({ type: 'update_privilege', name: playerNameForChat, badge: data.privilege.badge, color: data.privilege.color }));
        }
    } catch(e) { console.error(e); }
}

function addShopButton() {
    const sp = document.getElementById('statsPanel');
    if (sp && !document.getElementById('shopBtn')) {
        const btn = document.createElement('button');
        btn.id = 'shopBtn';
        btn.className = 'donate-btn';
        btn.textContent = '💎 Магазин';
        btn.onclick = () => showPrivilegeShop();
        btn.style.marginLeft = '10px';
        sp.appendChild(btn);
    }
}

function updateDiamondsDisplay() {
    let ds = document.getElementById('diamondsDisplay');
    if (!ds && player) {
        ds = document.createElement('span');
        ds.id = 'diamondsDisplay';
        ds.className = 'stat';
        document.getElementById('statsPanel').appendChild(ds);
    }
    if (ds) ds.innerHTML = `💎 ${playerDiamonds}`;
}

// ============ ЗАПУСК ============
gameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = gameInput.value.trim();
        if (name && !sessionId && !player) createCharacter(name);
        gameInput.value = '';
    }
});

if (!loadGameFromLocal()) {
    renderLocationButtons();
    addMessage(`🖥️ Сервер: ${API_BASE_URL}`, 'system');
    addMessage(`🖱️ Введите имя персонажа и нажмите Enter`, 'system');
}

setTimeout(() => connectChat(), 1000);
