let sessionId = null;
let player = null;
let currentLocation = "Стена Мария";
let inBattle = false;
let currentBattleId = null;
let waitingForName = true;  // <-- ДОБАВЛЕНО: ждём ввод имени

const messagesDiv = document.getElementById('messages');
const buttonsPanel = document.getElementById('buttonsPanel');
const statsPanel = document.getElementById('statsPanel');
const gameInput = document.getElementById('gameInput');

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
        <span class="stat">❤️ ${player.health}/${player.maxHealth}</span>
        <span class="stat">⚡ ${player.energy}/${player.maxEnergy}</span>
        <span class="stat">💰 ${player.gold}</span>
        <span class="stat">🗡️ ${player.attack}</span>
        <span class="stat">🛡️ ${player.defense}</span>
        <span class="stat">🏃 ${player.agility}</span>
    `;
}

function renderLocationButtons() {
    const buttonsMap = {
        "Стена Мария": ["Стена Роза", "За стеной", "Казармы", "Торговый район", "Центральная площадь", "Дом Аккерманов", "stats", "inventory"],
        "Стена Роза": ["Стена Мария", "Стена Сина", "Тренировочная площадка", "Госпиталь", "Лаборатория", "stats"],
        "Стена Сина": ["Стена Роза", "Королевский дворец", "Рынок Сины", "Храм воинов", "Госпиталь", "stats"],
        "За стеной": ["hunt", "explore", "Броня Титана", "Колоссальный титан", "Дракон", "Назад"],
        "Казармы": ["train_odm", "train_normal", "buy_odm", "buy_gas", "buy_blades", "Назад"],
        "Тренировочная площадка": ["train_odm", "train_normal", "Назад"],
        "Торговый район": ["Магазин оружия", "Аптека", "Магазин ODM", "Назад"],
        "Магазин оружия": ["buy_sword", "buy_shield", "Назад"],
        "Аптека": ["buy_potion", "Назад"],
        "Магазин ODM": ["buy_gas", "buy_blades", "Назад"],
        "Центральная площадь": ["rest", "daily", "Назад"],
        "Госпиталь": ["heal", "Назад"],
        "Лаборатория": ["Сдать трофеи", "Назад"],
        "Королевский дворец": ["Получить награду", "Назад"],
        "Рынок Сины": ["Продать травы", "Назад"],
        "Храм воинов": ["Благословение", "Назад"],
        "Дом Аккерманов": ["talk_mikasa", "mikasa_status", "summon_mikasa", "Назад"]
    };
    
    const actionNames = {
        "stats": "📊 Характеристики",
        "inventory": "🎒 Инвентарь",
        "hunt": "🎯 Охота на титанов",
        "explore": "🔍 Исследовать лес",
        "train_odm": "🎯 Тренировка с ODM",
        "train_normal": "💪 Без ODM",
        "buy_odm": "🛡️ Купить ODM (100g)",
        "buy_gas": "⛽ Купить газ (20g)",
        "buy_blades": "🔪 Купить лезвия (10g)",
        "buy_sword": "🗡️ Купить меч (50g)",
        "buy_shield": "🛡️ Купить щит (30g)",
        "buy_potion": "🧪 Зелье здоровья (20g)",
        "rest": "😴 Отдохнуть",
        "daily": "🎁 Ежедневная награда",
        "heal": "🏥 Лечиться (10g)",
        "talk_mikasa": "💬 Поговорить с Микасой",
        "mikasa_status": "📊 Статус Микасы",
        "summon_mikasa": "👥 Призвать Микасу",
        "Назад": "⬅️ Назад",
        "Стена Мария": "🏛️ Стена Мария",
        "Стена Роза": "🏛️ Стена Роза",
        "Стена Сина": "🏛️ Стена Сина",
        "За стеной": "🌲 За стену",
        "Казармы": "⚔️ Казармы",
        "Торговый район": "🛒 Торговый район",
        "Центральная площадь": "🏙️ Центральная площадь",
        "Тренировочная площадка": "🎯 Тренировочная площадка",
        "Госпиталь": "🏥 Госпиталь",
        "Лаборатория": "🔬 Лаборатория",
        "Королевский дворец": "👑 Королевский дворец",
        "Рынок Сины": "💰 Рынок Сины",
        "Храм воинов": "🛐 Храм воинов",
        "Магазин оружия": "⚔️ Магазин оружия",
        "Аптека": "❤️ Аптека",
        "Магазин ODM": "⚡ Магазин ODM",
        "Дом Аккерманов": "🏠 Дом Аккерманов",
        "Броня Титана": "🛡️ Броня Титана (10+)",
        "Колоссальный титан": "🔥 Колоссальный титан (20+)",
        "Дракон": "🐉 Дракон (30+)",
        "Получить награду": "🏆 Получить награду",
        "Продать травы": "🌿 Продать травы",
        "Благословение": "🙏 Благословение (50g)",
        "Сдать трофеи": "🎖️ Сдать трофеи"
    };
    
    const acts = buttonsMap[currentLocation] || ["Стена Мария", "stats"];
    const grid = document.createElement('div');
    grid.className = 'button-grid';
    
    acts.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'game-btn';
        if (action === "hunt" || action.includes("Титан") || action.includes("Дракон")) btn.classList.add('btn-danger');
        if (action === "rest" || action === "heal") btn.classList.add('btn-warning');
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
    try {
        const response = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: action, battle_id: currentBattleId })
        });
        const data = await response.json();
        
        if (data.error) {
            addMessage(`❌ ${data.error}`, 'error');
            return;
        }
        
        if (data.location) {
            currentLocation = data.location;
            addMessage(`📍 ${data.description || data.location}`, 'system');
            if (data.player) player = data.player;
            updateStats();
            renderLocationButtons();
            return;
        }
        
        if (data.battle_start) {
            inBattle = true;
            currentBattleId = data.battle_id;
            addMessage(`⚔️ ВСТРЕЧА С ${data.enemy}!`, 'combat');
            addMessage(data.description, 'combat');
            if (data.weak_spot) addMessage(`🎯 Слабое место: ${data.weak_spot}`, 'combat');
            addMessage(`❤️ Ваше здоровье: ${data.player_health}`, 'combat');
            addMessage(`💀 Здоровье врага: ${data.enemy_health}/${data.enemy_max_health}`, 'combat');
            renderBattleButtons();
            return;
        }
        
        if (data.victory) {
            inBattle = false;
            currentBattleId = null;
            addMessage(`🎉 ${data.message}`, 'victory');
            if (data.player) player = data.player;
            updateStats();
            renderLocationButtons();
            return;
        }
        
        if (data.defeat) {
            inBattle = false;
            currentBattleId = null;
            addMessage(`💀 ${data.message}`, 'error');
            if (data.player) player = data.player;
            if (player) currentLocation = player.location || "Стена Мария";
            updateStats();
            renderLocationButtons();
            return;
        }
        
        if (data.fled) {
            inBattle = false;
            currentBattleId = null;
            addMessage(`🏃 ${data.message}`, 'system');
            if (data.player) player = data.player;
            updateStats();
            renderLocationButtons();
            return;
        }
        
        if (data.action === "attack" || data.action === "heal" || data.action === "flee_fail") {
            addMessage(data.message, 'combat');
            if (data.player_health) addMessage(`❤️ Ваше здоровье: ${data.player_health}`, 'combat');
            if (data.enemy_health) addMessage(`💀 Здоровье врага: ${data.enemy_health}/${data.enemy_max_health}`, 'combat');
            if (data.player) player = data.player;
            updateStats();
            return;
        }
        
        if (data.success) {
            addMessage(`✅ ${data.message}`, 'victory');
            if (data.player) player = data.player;
            updateStats();
            return;
        }
        
        if (data.stats) {
            const p = data.stats;
            addMessage(`📊 ХАРАКТЕРИСТИКИ ${p.name}
❤️ Здоровье: ${p.health}/${p.max_health}
⚡ Энергия: ${p.energy}/${p.max_energy}
⭐ Уровень: ${p.level}
📈 Опыт: ${p.exp}/${p.max_exp}
⚔️ Атака: ${p.attack}
🛡️ Защита: ${p.defense}
🏃 Ловкость: ${p.agility}
💰 Золото: ${p.gold}
📍 Локация: ${p.location}`, 'system');
            return;
        }
        
        if (data.inventory) {
            let text = "🎒 ИНВЕНТАРЬ:\n";
            if (data.inventory.length === 0) text += "Пусто";
            else {
                const counts = {};
                data.inventory.forEach(item => counts[item] = (counts[item] || 0) + 1);
                for (const [item, count] of Object.entries(counts)) {
                    text += `• ${item}${count > 1 ? ` x${count}` : ''}\n`;
                }
            }
            if (data.player) {
                text += `\n⛽ Газ ODM: ${data.player.gas_level}/100`;
                text += `\n🔪 Лезвия: ${data.player.blades_count}/6`;
            }
            addMessage(text, 'system');
            return;
        }
        
        if (data.mikasa_status) {
            const levelText = ["Незнакомец", "Знакомый", "Товарищ", "Друг", "Близкий друг", "Доверенное лицо"];
            addMessage(`❤️ ОТНОШЕНИЯ С МИКАСОЙ
Уровень: ${levelText[data.level]} (${data.level}/5)
Прогресс: ${data.relationship}/100
В команде: ${data.has_companion ? "✅ Да" : "❌ Нет"}`, 'system');
            return;
        }
        
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}`, 'error');
        console.error(error);
    }
}

async function createCharacter(name) {
    addMessage(`📡 Отправка имени "${name}" на сервер...`, 'system');
    try {
        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (data.success) {
            sessionId = data.session_id;
            player = data.player;
            currentLocation = player.location;
            waitingForName = false;
            addMessage(`✨ Создан персонаж ${player.name}!`, 'victory');
            updateStats();
            renderLocationButtons();
        } else {
            addMessage(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        addMessage(`❌ Ошибка: ${error.message}. Убедитесь, что сервер запущен!`, 'error');
        console.error(error);
    }
}

// Обработка ввода имени
gameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = gameInput.value.trim();
        if (name && !player) {
            createCharacter(name);
            gameInput.value = '';
            gameInput.placeholder = "Введите команду...";
        }
    }
});

// Загружаем начальные кнопки
renderLocationButtons();
addMessage("🖱️ Введите имя персонажа и нажмите Enter", 'system');
