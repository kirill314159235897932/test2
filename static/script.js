// ============ НАСТРОЙКИ ============
const API_BASE_URL = 'https://rpg-backend-uch9.onrender.com';
const CHAT_WS_URL = 'wss://rpg-chat-1.onrender.com';

// ============ ПЕРЕМЕННЫЕ ============
let sessionId = null;
let player = null;
let currentLocation = "Стена Мария";
let inBattle = false;
let currentBattleId = null;

// Чат
let chatSocket = null;
let playerNameForChat = null;

// Кулдауны
let lastRestTime = null;
let lastDailyTime = null;
let lastTrainingTime = null;
let lastDiceTime = null;

// Донат
let playerDiamonds = 0;
let currentPrivilege = null;

// DOM элементы
const messagesDiv = document.getElementById('messages');
const buttonsPanel = document.getElementById('buttonsPanel');
const statsPanel = document.getElementById('statsPanel');
const gameInput = document.getElementById('gameInput');

// ============ ФУНКЦИИ СОХРАНЕНИЯ ============
function saveGameToLocal() {
    if (sessionId && player) {
        const saveData = { sessionId, player, currentLocation, savedAt: new Date().toISOString() };
        localStorage.setItem('rpg_save', JSON.stringify(saveData));
        addMessage(`💾 Игра сохранена!`, 'victory');
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
            addMessage(`📂 Загрузка сохранения... С возвращением, ${player.name}!`, 'victory');
            updateStats();
            renderLocationButtons();
            setTimeout(() => {
                addShopButton();
                updateDiamonds();
                updateChatPrivilege();
            }, 500);
            return true;
        } catch(e) { console.error(e); clearSave(); }
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
        addMessage(`🗑️ Сохранение удалено! Обновите страницу и создайте нового персонажа.`, 'system');
        updateStats();
        renderLocationButtons();
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
        "train_odm": "🎯 Тренировка с ODM", "train_normal": "💪 Без ODM", "Улучшить ODM": "⚡ Улучшить ODM",
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
    console.log('📤 sendAction вызван с action:', action);
    
    // НАВИГАЦИЯ ПО ЛОКАЦИЯМ
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
    
    // Сохранение и удаление
    if (action === "save_game") {
        if (sessionId && player) { saveGameToLocal(); }
        else { addMessage(`❌ Нечего сохранять - создайте персонажа!`, 'error'); }
        return;
    }
    if (action === "delete_save") { deleteSave(); return; }
    
    // Отдых
    if (action === "rest") {
        if (!lastRestTime || Date.now() - lastRestTime > 300000) {
            if (player) {
                player.health = player.max_health;
                player.energy = player.max_energy;
                if (player.odm_gear) { player.gas_level = 100; player.blades_count = 6; }
            }
            lastRestTime = Date.now();
            addMessage(`😴 Вы отдохнули! Здоровье и энергия восстановлены.`, 'victory');
            updateStats(); saveGameToLocal();
        } else {
            const remaining = Math.ceil((300000 - (Date.now() - lastRestTime)) / 60000);
            addMessage(`⏳ Отдых возможен через ${remaining} минут`, 'error');
        }
        return;
    }
    
    // Ежедневная награда
    if (action === "daily") {
        if (!lastDailyTime || Date.now() - lastDailyTime > 86400000) {
            if (player) {
                const reward = Math.floor(Math.random() * 100) + 50;
                player.gold += reward;
            }
            lastDailyTime = Date.now();
            addMessage(`🎁 Ежедневная награда! +${reward} золота`, 'victory');
            updateStats(); saveGameToLocal();
        } else {
            const remaining = Math.ceil((86400000 - (Date.now() - lastDailyTime)) / 3600000);
            addMessage(`⏳ Следующая награда через ${remaining} часов`, 'error');
        }
        return;
    }
    
    // Лечение в госпитале
    if (action === "heal" && player && player.gold >= 10) {
        player.gold -= 10;
        player.health = player.max_health;
        addMessage(`🏥 Вылечены! Здоровье: ${player.health}/${player.max_health}`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Разговоры с горожанами
    if (action === "talk_citizens") {
        const dialogues = ["Горожанин: 'Титаны становятся все опаснее...'", "Горожанин: 'Разведкорпус готовит новую экспедицию.'", "Горожанин: 'Береги себя за стеной!'"];
        addMessage(`🗣️ ${dialogues[Math.floor(Math.random() * dialogues.length)]}`, 'system');
        return;
    }
    
    // Таверна - игра в кости
    if (action === "play_dice" && player && player.gold >= 10) {
        if (lastDiceTime && Date.now() - lastDiceTime < 5000) {
            addMessage(`⏳ Подождите 5 секунд перед следующей игрой!`, 'error');
            return;
        }
        player.gold -= 10;
        const playerDice = Math.floor(Math.random() * 6) + 1;
        const tavernDice = Math.floor(Math.random() * 6) + 1;
        lastDiceTime = Date.now();
        
        if (playerDice > tavernDice) {
            const win = Math.floor(Math.random() * 15) + 10;
            player.gold += win;
            addMessage(`🎲 ВЫ ВЫИГРАЛИ! Ваша кость: ${playerDice}, кость таверны: ${tavernDice}. Выигрыш: ${win} золота!`, 'victory');
        } else if (playerDice < tavernDice) {
            addMessage(`🎲 ВЫ ПРОИГРАЛИ! Ваша кость: ${playerDice}, кость таверны: ${tavernDice}. Потеряно: 10 золота.`, 'error');
        } else {
            player.gold += 5;
            addMessage(`🎲 НИЧЬЯ! Ваша кость: ${playerDice}, кость таверны: ${tavernDice}. Возвращено 5 золота.`, 'system');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Сплетни
    if (action === "gossip") {
        const rumors = ["Говорят, что в лесу видели странного титана...", "Шепчутся, что кто-то нашел древний артефакт.", "Королевский дворец готовит большую экспедицию.", "В лаборатории Ханджи проводят опасные эксперименты."];
        addMessage(`🗣️ ${rumors[Math.floor(Math.random() * rumors.length)]}`, 'system');
        return;
    }
    
    // Выпить эля
    if (action === "drink_beer" && player && player.gold >= 5) {
        player.gold -= 5;
        player.energy = Math.min(player.max_energy, player.energy + 10);
        addMessage(`🍺 Вы выпили эль! Энергия +10`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Если нет сессии - отправляем на сервер
    if (!sessionId) {
        addMessage(`❌ Сначала создайте персонажа! Введите имя и нажмите Enter.`, 'error');
        return;
    }
    
    // Отправка на сервер
    try {
        const response = await fetch(`${API_BASE_URL}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: action, battle_id: currentBattleId })
        });
        const data = await response.json();
        
        if (data.error && data.error.includes('Сессия не найдена')) {
            addMessage(`⚠️ Сессия устарела. Пожалуйста, создайте персонажа заново.`, 'error');
            clearSave(); updateStats(); renderLocationButtons();
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
            if (!player.titan_kills) player.titan_kills = {};
            if (!player.quests) player.quests = {};
            addMessage(`✨ Создан персонаж ${player.name}!`, 'victory');
            updateStats();
            renderLocationButtons();
            saveGameToLocal();
            addShopButton();
            await updateDiamonds();
            await updateChatPrivilege();
        } else {
            addMessage(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}. Сервер доступен? ${API_BASE_URL}`, 'error');
        console.error(error);
    }
}

function levelUp() {
    player.level++;
    player.exp -= player.max_exp;
    player.max_exp = Math.floor(player.max_exp * 1.5);
    player.max_health += 20;
    player.health = player.max_health;
    player.max_energy += 10;
    player.energy = player.max_energy;
    player.attack += 5;
    player.defense += 3;
    player.agility += 2;
    addMessage(`⭐ НОВЫЙ УРОВЕНЬ ${player.level}!`, 'victory');
    saveGameToLocal();
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
    while (container.children.length > 100) container.removeChild(container.firstChild);
}

function connectChat() {
    chatSocket = new WebSocket(CHAT_WS_URL);
    chatSocket.onopen = () => addChatMessage('system', '🔌 Подключено к чату!');
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
    chatSocket.onerror = () => addChatMessage('system', '⚠️ Ошибка подключения к чату');
    chatSocket.onclose = () => {
        addChatMessage('system', '🔌 Отключено от чата. Переподключение...');
        setTimeout(connectChat, 5000);
    };
    setTimeout(() => {
        if (playerNameForChat) updateChatPrivilege();
    }, 2000);
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
    if (!playerNameForChat && player) playerNameForChat = player.name;
    if (!playerNameForChat) {
        addChatMessage('system', '❌ Сначала создайте персонажа');
        return;
    }
    chatSocket.send(JSON.stringify({ name: playerNameForChat, text: text.substring(0, 100) }));
    input.value = '';
}

function toggleChat() {
    const window = document.getElementById('chatWindow');
    if (window) window.classList.toggle('collapsed');
}

// ============ ДОНАТ-СИСТЕМА ============

async function updateDiamonds() {
    if (!sessionId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/d
