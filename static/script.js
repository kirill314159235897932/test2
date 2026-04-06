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
        "Центральная площадь": ["rest", "talk_citizens", "tavern", "daily", "stats", "save_game", "delete_save", "Назад"],
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
        "rest": "😴 Отдохнуть", "talk_citizens": "🗣️ Поговорить с горожанами", "tavern": "🍺 Таверна", "daily": "🎁 Ежедневная награда",
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
        else if (["Таверна"].includes(currentLocation)) currentLocation = "Центральная площадь";
        else if (["Лаборатория", "Королевский дворец", "Рынок Сины", "Храм воинов"].includes(currentLocation)) currentLocation = "Стена Сина";
        else if (["Госпиталь"].includes(currentLocation)) currentLocation = "Стена Роза";
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
            player.health = player.max_health;
            player.energy = player.max_energy;
            if (player.odm_gear) { player.gas_level = 100; player.blades_count = 6; }
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
            const reward = Math.floor(Math.random() * 100) + 50;
            player.gold += reward;
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
    if (action === "heal" && player.gold >= 10) {
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
    if (action === "play_dice" && player.gold >= 10) {
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
    if (action === "drink_beer" && player.gold >= 5) {
        player.gold -= 5;
        player.energy = Math.min(player.max_energy, player.energy + 10);
        addMessage(`🍺 Вы выпили эль! Энергия +10`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Купить медикаменты
    if (action === "buy_medicine" && player.gold >= 15) {
        player.gold -= 15;
        player.inventory.push("Антидот");
        addMessage(`💊 Куплены медикаменты (Антидот)!`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Сдать трофеи
    if (action === "submit_trophies") {
        const trophies = ["Фрагмент брони Титана", "Часть пара Колосса", "Чешуя дракона", "Редкий артефакт", "Драгоценный камень"];
        let totalValue = 0;
        let sold = [];
        trophies.forEach(trophy => {
            const count = player.inventory.filter(i => i === trophy).length;
            if (count > 0) {
                sold.push(`${trophy} x${count}`);
                player.inventory = player.inventory.filter(i => i !== trophy);
                if (trophy === "Фрагмент брони Титана") totalValue += 100 * count;
                else if (trophy === "Часть пара Колосса") totalValue += 150 * count;
                else if (trophy === "Чешуя дракона") totalValue += 200 * count;
                else if (trophy === "Редкий артефакт") totalValue += 50 * count;
                else if (trophy === "Драгоценный камень") totalValue += 30 * count;
            }
        });
        if (sold.length > 0) {
            player.gold += totalValue;
            addMessage(`🔬 Сдано трофеев:\n${sold.join('\n')}\n💰 Получено: ${totalValue} золота!`, 'victory');
        } else {
            addMessage(`🔬 У вас нет трофеев для сдачи.`, 'system');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Изучить артефакты
    if (action === "study_artifacts") {
        const hasArtifact = player.inventory.some(i => ["Фрагмент брони Титана", "Часть пара Колосса", "Чешуя дракона", "Редкий артефакт"].includes(i));
        if (hasArtifact && Math.random() < 0.4) {
            const bonus = ["Зелье мудрости", "Эссенция титана", "Улучшенное лезвие"][Math.floor(Math.random() * 3)];
            player.inventory.push(bonus);
            addMessage(`🔬 Изучение успешно! Получен бонус: ${bonus}`, 'victory');
        } else if (hasArtifact) {
            addMessage(`🔬 Изучение не дало результатов.`, 'system');
        } else {
            addMessage(`🔬 У вас нет артефактов для изучения.`, 'error');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Награда за титанов
    if (action === "get_titan_reward") {
        const totalKills = Object.values(player.titan_kills || {}).reduce((a, b) => a + b, 0);
        if (totalKills >= 10) {
            const reward = Math.floor(totalKills / 10) * 50;
            player.gold += reward;
            addMessage(`👑 Королевская награда! За ${totalKills} убитых титанов вы получаете ${reward} золота!`, 'victory');
        } else {
            addMessage(`👑 Убито титанов: ${totalKills}/10. Вернитесь после 10 убийств.`, 'system');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Получить титул
    if (action === "get_title") {
        const totalKills = Object.values(player.titan_kills || {}).reduce((a, b) => a + b, 0);
        if (totalKills >= 50) {
            player.attack += 5;
            player.defense += 5;
            addMessage(`👑 Вы получили титул "Лорд Охотник"! Атака +5, Защита +5`, 'victory');
        } else if (totalKills >= 25) {
            player.attack += 3;
            addMessage(`👑 Вы получили титул "Мастер Охотник"! Атака +3`, 'victory');
        } else {
            addMessage(`👑 Для получения титула нужно убить 25+ титанов. У вас: ${totalKills}`, 'system');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Продать травы
    if (action === "sell_herbs") {
        const herbCount = player.inventory.filter(i => i === "Лечебные травы").length;
        if (herbCount > 0) {
            player.gold += herbCount * 5;
            player.inventory = player.inventory.filter(i => i !== "Лечебные травы");
            addMessage(`💰 Продано трав: ${herbCount} шт. Получено: ${herbCount * 5} золота!`, 'victory');
        } else {
            addMessage(`💰 У вас нет лечебных трав для продажи.`, 'error');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Продать трофеи
    if (action === "sell_trophies") {
        const sellable = { "Редкий артефакт": 40, "Драгоценный камень": 25, "Карта сокровищ": 70 };
        let totalValue = 0;
        let sold = [];
        for (const [item, price] of Object.entries(sellable)) {
            const count = player.inventory.filter(i => i === item).length;
            if (count > 0) {
                sold.push(`${item} x${count}`);
                player.inventory = player.inventory.filter(i => i !== item);
                totalValue += price * count;
            }
        }
        if (sold.length > 0) {
            player.gold += totalValue;
            addMessage(`💰 Продано:\n${sold.join('\n')}\nПолучено: ${totalValue} золота!`, 'victory');
        } else {
            addMessage(`💰 У вас нет трофеев для продажи.`, 'error');
        }
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Купить редкие компоненты
    if (action === "buy_rare_components") {
        addMessage(`⚗️ РЕДКИЕ КОМПОНЕНТЫ\n\n• Эссенция титана (80g) - Атака +3\n• Кристалл маны (120g) - Энергия +20\n• Порошок феникса (150g) - Здоровье +50\n\nВаше золото: ${player.gold}`, 'system');
        return;
    }
    if (action === "Купить Эссенцию титана" && player.gold >= 80) {
        player.gold -= 80; player.attack += 3;
        addMessage(`⚗️ Эссенция титана использована! Атака +3`, 'victory');
        updateStats(); saveGameToLocal(); return;
    }
    if (action === "Купить Кристалл маны" && player.gold >= 120) {
        player.gold -= 120; player.max_energy += 20; player.energy = player.max_energy;
        addMessage(`⚗️ Кристалл маны использован! Макс. энергия +20`, 'victory');
        updateStats(); saveGameToLocal(); return;
    }
    if (action === "Купить Порошок феникса" && player.gold >= 150) {
        player.gold -= 150; player.health = Math.min(player.max_health, player.health + 50);
        addMessage(`⚗️ Порошок феникса использован! Здоровье +50`, 'victory');
        updateStats(); saveGameToLocal(); return;
    }
    
    // Благословение
    if (action === "get_blessing" && player.gold >= 50) {
        player.gold -= 50;
        player.attack += Math.floor(Math.random() * 3) + 1;
        player.defense += Math.floor(Math.random() * 3) + 1;
        player.agility += Math.floor(Math.random() * 3) + 1;
        addMessage(`🙏 Благословение получено! Атака, защита и ловкость увеличены!`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Медитация
    if (action === "meditate") {
        if (!lastRestTime || Date.now() - lastRestTime > 300000) {
            player.energy = Math.min(player.max_energy, player.energy + 30);
            player.health = Math.min(player.max_health, player.health + 20);
            addMessage(`🧘 Медитация восстановила силы! Энергия +30, Здоровье +20`, 'victory');
            updateStats(); saveGameToLocal();
        } else {
            addMessage(`🧘 Вы уже медитировали недавно.`, 'error');
        }
        return;
    }
    
    // Пожертвование
    if (action === "donate" && player.gold >= 100) {
        player.gold -= 100;
        player.max_health += 10;
        player.health = player.max_health;
        addMessage(`💰 Пожертвование принято! Макс. здоровье +10`, 'victory');
        updateStats(); saveGameToLocal();
        return;
    }
    
    // Взять задание
    if (action === "Взять задание") {
        const quests = { "Аномальный титан": { goal: 3, reward: 100 }, "Звероподобный титан": { goal: 2, reward: 150 } };
        if (!player.quests) player.quests = {};
        let questGiven = false;
        for (const [questName, quest] of Object.entries(quests)) {
            if (!player.quests[questName]) {
                player.quests[questName] = { goal: quest.goal, progress: 0, reward: quest.reward };
                addMessage(`📜 Получено новое задание: ${questName}. Цель: убить ${quest.goal}. Награда: ${quest.reward} золота!`, 'victory');
                questGiven = true;
                break;
            }
        }
        if (!questGiven) addMessage(`📜 Нет доступных заданий. Выполните текущие.`, 'system');
        saveGameToLocal();
        return;
    }
    
    // Микаса
    if (action === "talk_mikasa") {
        if (!player.mikasa_relationship) player.mikasa_relationship = 0;
        const gain = Math.floor(Math.random() * 3) + 1;
        player.mikasa_relationship = Math.min(100, player.mikasa_relationship + gain);
        let newLevel = 0;
        if (player.mikasa_relationship >= 100) newLevel = 5;
        else if (player.mikasa_relationship >= 80) newLevel = 4;
        else if (player.mikasa_relationship >= 60) newLevel = 3;
        else if (player.mikasa_relationship >= 40) newLevel = 2;
        else if (player.mikasa_relationship >= 20) newLevel = 1;
        const levelUp = newLevel > (player.mikasa_level || 0);
        player.mikasa_level = newLevel;
        addMessage(`💬 Разговор с Микасой. Отношения +${gain} (${player.mikasa_relationship}/100)${levelUp ? ` ⭐ Уровень дружбы ${newLevel}!` : ''}`, 'system');
        saveGameToLocal();
        return;
    }
    
    if (action === "mikasa_status") {
        const levelNames = ["Незнакомец", "Знакомый", "Товарищ", "Друг", "Близкий друг", "Доверенное лицо"];
        addMessage(`❤️ ОТНОШЕНИЯ С МИКАСОЙ\nУровень: ${levelNames[player.mikasa_level || 0]} (${player.mikasa_level || 0}/5)\nПрогресс: ${player.mikasa_relationship || 0}/100`, 'system');
        return;
    }
    
    if (action === "invite_mikasa") {
        if ((player.mikasa_level || 0) < 1) {
            addMessage(`❌ Микаса не хочет присоединяться. Улучшите отношения (нужен 1+ уровень).`, 'error');
        } else if (player.has_companion) {
            addMessage(`👤 Микаса уже в вашей команде!`, 'system');
        } else {
            player.has_companion = true;
            player.companion_name = "Микаса Аккерман";
            addMessage(`👤 Микаса присоединилась к вашей команде! Она будет помогать в бою.`, 'victory');
            saveGameToLocal();
        }
        return;
    }
    
    if (action === "train_with_mikasa") {
        if (!player.odm_gear) { addMessage(`❌ Для тренировки с Микасой нужно ODM-снаряжение!`, 'error'); return; }
        if (player.gas_level < 30 || player.blades_count < 4) { addMessage(`❌ Недостаточно газа или лезвий для тренировки!`, 'error'); return; }
        player.gas_level -= 30;
        player.blades_count -= 4;
        player.energy -= 40;
        const expGain = Math.floor(Math.random() * 30) + 50;
        const agilityGain = Math.floor(Math.random() * 4) + 2;
        player.exp += expGain;
        player.agility += agilityGain;
        const relationshipGain = Math.floor(Math.random() * 4) + 3;
        player.mikasa_relationship = Math.min(100, (player.mikasa_relationship || 0) + relationshipGain);
        addMessage(`⚔️ Тренировка с Микасой! +${expGain} опыта, ловкость +${agilityGain}, отношения +${relationshipGain}`, 'victory');
        if (player.exp >= player.max_exp) levelUp();
        updateStats(); saveGameToLocal();
        return;
    }
    
    if (action === "give_gift") {
        const gifts = ["Красный шарф", "Шоколад", "Книга", "Цветы", "Чай"];
        const availableGifts = gifts.filter(g => player.inventory.includes(g));
        if (availableGifts.length === 0) {
            addMessage(`🎁 У вас нет подарков для Микасы. Купите их в магазине или найдите в лесу.`, 'error');
            return;
        }
        const gift = availableGifts[0];
        const giftValues = { "Красный шарф": 30, "Шоколад": 15, "Книга": 20, "Цветы": 25, "Чай": 10 };
        const value = giftValues[gift];
        player.inventory = player.inventory.filter(i => i !== gift);
        player.mikasa_relationship = Math.min(100, (player.mikasa_relationship || 0) + value);
        addMessage(`🎁 Вы подарили Микасе ${gift}! Отношения +${value}!`, 'victory');
        saveGameToLocal();
        return;
    }
    
    // Если нет сессии
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

// ============ KEEP-ALIVE ============
let lastPing = 0;
async function keepAlive() {
    const now = Date.now();
    if (now - lastPing < 540000) return;
    lastPing = now;
    try {
        await fetch(`${API_BASE_URL}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stats', session_id: sessionId }) }).catch(() => {});
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) chatSocket.send(JSON.stringify({ type: 'ping' }));
        else if (chatSocket && chatSocket.readyState !== WebSocket.OPEN) connectChat();
    } catch(e) {}
}
setInterval(keepAlive, 540000);
setTimeout(keepAlive, 60000);

// ============ ЗАПУСК ============
gameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = gameInput.value.trim();
        if (name && !sessionId && !player) {
            createCharacter(name);
            gameInput.value = '';
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

setTimeout(() => { connectChat(); }, 1000);
console.log('🎮 Игра загружена!');
