/* =========================================================
   TutaCode — Головна клієнтська логіка (Android / iOS / Web)
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'tutacode_client_v2';

  const DEFAULT_STATE = {
    lang: 'ua',
    age: 'kid',      // 'kid' (9-12) | 'teen' (15+)
    theme: 'dark',   // 'dark' | 'light'
    phonePreview: false,
    xp: 20,
    badges: {
      robot: false,
      circuit: false,
      bug: false,
      quiz: false,
      polyglot: false,
      explorer: false
    },
    currency: 'UAH', // 'UAH' | 'EUR' | 'USD'
    billing: 'monthly', // 'monthly' | 'yearly'
    recTrack: null,
    arena: {
      tab: 'short', // 'short' | 'tour' | 'review' | 'main'
      myTrack: 'python', // 'logic' | 'gamedev' | 'web' | 'python'
      sprintsDone: { s1: false, s2: false, s3: false },
      tourAnswer: 0,
      tourSubmitted: false,
      reviewsDone: { w1: false, w2: false },
      ratings: {
        w1: { idea: 5, logic: 4, cool: 5 },
        w2: { idea: 4, logic: 5, cool: 5 }
      }
    }
  };

  let state = loadState();

  function normalizeArenaTrack(tr) {
    const legacyMap = { Python: 'python', Arduino: 'logic', Web: 'web' };
    const mapped = legacyMap[tr] || tr;
    return ['logic', 'gamedev', 'web', 'python'].includes(mapped) ? mapped : 'python';
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      const mergedArena = {
        ...DEFAULT_STATE.arena,
        ...(parsed.arena || {}),
        sprintsDone: { ...DEFAULT_STATE.arena.sprintsDone, ...((parsed.arena && parsed.arena.sprintsDone) || {}) },
        reviewsDone: { ...DEFAULT_STATE.arena.reviewsDone, ...((parsed.arena && parsed.arena.reviewsDone) || {}) },
        ratings: { ...DEFAULT_STATE.arena.ratings, ...((parsed.arena && parsed.arena.ratings) || {}) }
      };
      mergedArena.myTrack = normalizeArenaTrack(mergedArena.myTrack);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        badges: { ...DEFAULT_STATE.badges, ...(parsed.badges || {}) },
        arena: mergedArena
      };
    } catch (_) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  /* ---------------- Словник і локалізація ---------------- */
  function t(path, vars) {
    const dict = (window.I18N && window.I18N[state.lang]) || window.I18N.ua;
    const parts = path.split('.');
    let cur = dict;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return path;
      cur = cur[parts[i]];
    }
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && ('kid' in cur || 'teen' in cur)) {
      cur = cur[state.age] || cur.kid;
    }
    if (typeof cur === 'string' && vars) {
      return cur.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    }
    return cur !== undefined ? cur : path;
  }

  function applyStaticTranslations() {
    document.documentElement.lang = state.lang === 'ua' ? 'uk' : 'ru';
    document.title = t('meta.title');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('meta.desc'));

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (typeof val === 'string') {
        if (val.includes('<mark>') || val.includes('<code>')) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  /* ---------------- Тости, XP, Рівні та Конфеті ---------------- */
  const LEVEL_THRESHOLDS = [0, 50, 110, 180, 260];

  function getLevelIndex(xp) {
    let idx = 0;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (xp >= LEVEL_THRESHOLDS[i]) idx = i;
    }
    return idx;
  }

  function showToast(text, modifier) {
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const div = document.createElement('div');
    div.className = 'toast' + (modifier ? ' ' + modifier : '');
    div.textContent = text;
    wrap.appendChild(div);
    setTimeout(() => {
      div.classList.add('out');
      setTimeout(() => div.remove(), 320);
    }, 2600);
  }

  function burstConfetti(count = 26) {
    const colors = ['#B8FF3C', '#22D3EE', '#8B5CF6', '#FF4FA3', '#FF9F1C'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
      c.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      c.style.setProperty('--d', (1.8 + Math.random() * 1.1).toFixed(2) + 's');
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3000);
    }
  }

  function addXP(amount) {
    if (!amount || amount <= 0) return;
    const prevLvl = getLevelIndex(state.xp);
    state.xp += amount;
    const nextLvl = getLevelIndex(state.xp);
    saveState();

    const xpVal = document.getElementById('xpValue');
    const xpChip = document.getElementById('xpChip');
    if (xpVal) xpVal.textContent = state.xp;
    if (xpChip) {
      xpChip.classList.remove('bump');
      void xpChip.offsetWidth;
      xpChip.classList.add('bump');
    }

    showToast('+' + amount + ' XP ⚡', 'toast--xp');

    if (nextLvl > prevLvl) {
      const levels = t('rewards.levels');
      const lvlName = Array.isArray(levels) ? levels[nextLvl] : '';
      setTimeout(() => {
        showToast(t('toast.levelUp', { name: lvlName }), 'toast--level');
        burstConfetti(32);
      }, 450);
    }

    renderRewards();
  }

  function unlockBadge(key, xpReward = 25) {
    if (state.badges[key]) return false;
    state.badges[key] = true;
    saveState();
    const badgeObj = t('rewards.badges.' + key);
    const badgeName = badgeObj && badgeObj.name ? badgeObj.name : key;
    showToast(t('toast.badge', { name: badgeName }));
    burstConfetti(22);
    addXP(xpReward);
    renderRewards(key);
    updateGameTabChecks();
    return true;
  }

  function renderTutaMessage(el, html, status) {
    if (!el) return;
    el.className = 'tuta-msg anim' + (status ? ' is-' + status : '');
    el.innerHTML =
      '<svg class="tuta-msg__ava" aria-hidden="true"><use href="#tuta-bot"/></svg>' +
      '<div>' + html + '</div>';
  }

  /* ---------------- Перемикачі: Мова, Вік, Тема, Смартфон ---------------- */
  function syncHeaderControls() {
    document.body.setAttribute('data-age', state.age);
    document.body.setAttribute('data-theme', state.theme);
    document.body.classList.toggle('is-phone-preview', !!state.phonePreview);

    const xpVal = document.getElementById('xpValue');
    if (xpVal) xpVal.textContent = state.xp;

    document.querySelectorAll('[data-lang]').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === state.lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('[data-age-btn]').forEach((btn) => {
      const active = btn.getAttribute('data-age-btn') === state.age;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    }

    const phoneBtn = document.getElementById('phoneFrameToggle');
    if (phoneBtn) {
      phoneBtn.classList.toggle('is-active', !!state.phonePreview);
    }

    const ageRadioVal = state.age === 'teen' ? '15-18' : '7-11';
    const radio = document.querySelector('#signupForm input[name="age"][value="' + ageRadioVal + '"]');
    if (radio) radio.checked = true;
  }

  function setLanguage(lang) {
    if (lang !== 'ua' && lang !== 'ru') return;
    const changed = state.lang !== lang;
    state.lang = lang;
    saveState();
    syncHeaderControls();
    rerenderAll();
    if (changed) {
      unlockBadge('polyglot', 20);
    }
  }

  function setAge(age) {
    if (age !== 'kid' && age !== 'teen') return;
    state.age = age;
    saveState();
    syncHeaderControls();

    const bubble = document.getElementById('heroBubble');
    if (bubble) {
      bubble.classList.remove('pop');
      void bubble.offsetWidth;
      bubble.classList.add('pop');
    }

    // Синхронізуємо радіокнопку у формі реєстрації
    const ageRadioVal = age === 'teen' ? '15-18' : '7-11';
    const radio = document.querySelector('#signupForm input[name="age"][value="' + ageRadioVal + '"]');
    if (radio) radio.checked = true;

    rerenderAll();
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    syncHeaderControls();
  }

  function togglePhonePreview() {
    state.phonePreview = !state.phonePreview;
    saveState();
    syncHeaderControls();
    setTimeout(positionRobotElement, 60);
  }

  /* ---------------- Секція: Чат з AI-ментором Тутою ---------------- */
  let chatSolved = false;

  function renderChatDemo() {
    const body = document.getElementById('chatBody');
    const choicesWrap = document.getElementById('chatChoicesWrap');
    if (!body || !choicesWrap) return;

    const msgs = t('how.chat');
    body.innerHTML = '';
    if (Array.isArray(msgs)) {
      msgs.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'msg ' + (m.me ? 'msg--me' : 'msg--bot');
        div.textContent = m.t;
        body.appendChild(div);
      });
    }

    const choices = t('how.chatChoices');
    choicesWrap.innerHTML = '';
    if (Array.isArray(choices)) {
      const promptEl = document.createElement('div');
      promptEl.className = 'chat__prompt';
      promptEl.textContent = t('how.chatPrompt');
      choicesWrap.appendChild(promptEl);

      choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat__choice-btn';
        btn.textContent = choice.label;
        btn.addEventListener('click', () => {
          const userMsg = document.createElement('div');
          userMsg.className = 'msg msg--me';
          userMsg.textContent = choice.label;
          body.appendChild(userMsg);

          const botMsg = document.createElement('div');
          botMsg.className = 'msg msg--bot';
          botMsg.textContent = choice.reply;
          body.appendChild(botMsg);

          if (choice.ok && !chatSolved) {
            chatSolved = true;
            addXP(15);
            choicesWrap.innerHTML = '';
          }
        });
        choicesWrap.appendChild(btn);
      });
    }
  }

  /* =========================================================
     ГРА 1: Симулятор Робота (9+) та Автопілота if/else (15+)
     ========================================================= */
  const ROBOT_LEVELS = [
    {
      start: [0, 4],
      goal: [4, 0],
      rocks: [[2, 2], [2, 3]],
      solution: ['up', 'up', 'up', 'up', 'right', 'right', 'right', 'right'],
      hintKey: 'robot.hint1'
    },
    {
      start: [0, 4],
      goal: [4, 0],
      rocks: [[0, 2], [1, 2], [2, 2], [3, 2]],
      solution: ['right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
      hintKey: 'robot.hint2'
    },
    {
      start: [0, 4],
      goal: [4, 0],
      rocks: [[1, 4], [1, 3], [3, 1], [3, 0]],
      solution: ['up', 'up', 'right', 'right', 'up', 'up', 'right', 'right'],
      hintKey: 'robot.hint3'
    }
  ];

  const MAX_COMMANDS = 10;
  const DIR_ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
  const DIR_DELTAS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };

  let robotLevelIdx = 0;
  let robotCommands = [];
  let robotPos = [0, 4];
  let robotRunning = false;
  let robotLevelsWon = [false, false, false];

  function isRock(lvl, x, y) {
    return lvl.rocks.some(([rx, ry]) => rx === x && ry === y);
  }

  function buildRobotBoard() {
    const board = document.getElementById('robotBoard');
    const robotEl = document.getElementById('robotEl');
    if (!board || !robotEl) return;

    const lvl = ROBOT_LEVELS[robotLevelIdx];
    board.querySelectorAll('.cell').forEach((c) => c.remove());

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;

        if (x === lvl.start[0] && y === lvl.start[1]) {
          cell.classList.add('cell--start');
        } else if (x === lvl.goal[0] && y === lvl.goal[1]) {
          cell.classList.add('cell--goal');
          cell.innerHTML = '<span aria-hidden="true">🔋</span>';
        } else if (isRock(lvl, x, y)) {
          cell.classList.add('cell--rock');
          cell.innerHTML = '<span aria-hidden="true">🪨</span>';
        }
        board.appendChild(cell);
      }
    }

    robotPos = [lvl.start[0], lvl.start[1]];
    robotEl.classList.remove('face-left', 'shake', 'win');
    requestAnimationFrame(positionRobotElement);
  }

  function positionRobotElement() {
    const board = document.getElementById('robotBoard');
    const robotEl = document.getElementById('robotEl');
    if (!board || !robotEl) return;
    const targetCell = board.querySelector(
      '.cell[data-x="' + robotPos[0] + '"][data-y="' + robotPos[1] + '"]'
    );
    if (!targetCell) return;

    robotEl.style.width = targetCell.offsetWidth + 'px';
    robotEl.style.height = targetCell.offsetHeight + 'px';
    robotEl.style.transform =
      'translate(' + targetCell.offsetLeft + 'px, ' + targetCell.offsetTop + 'px)';
  }

  function renderRobotProgram(activeIdx, badIdx) {
    const list = document.getElementById('robotProgram');
    const count = document.getElementById('robotCount');
    const lvlChip = document.getElementById('robotLevel');
    if (!list || !count || !lvlChip) return;

    lvlChip.textContent = t('robot.level', {
      n: robotLevelIdx + 1,
      total: ROBOT_LEVELS.length
    });
    count.textContent = robotCommands.length + '/' + MAX_COMMANDS;

    list.innerHTML = '';
    if (robotCommands.length === 0) {
      const span = document.createElement('span');
      span.className = 'program__empty';
      span.textContent = t('robot.empty');
      list.appendChild(span);
      return;
    }

    robotCommands.forEach((dir, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'cmd' +
        (idx === activeIdx ? ' is-current' : '') +
        (idx === badIdx ? ' is-bad' : '');
      btn.textContent = DIR_ARROWS[dir] || '?';
      btn.addEventListener('click', () => {
        if (robotRunning) return;
        robotCommands.splice(idx, 1);
        renderRobotProgram();
      });
      list.appendChild(btn);
    });
  }

  function resetRobotPositionOnly() {
    const lvl = ROBOT_LEVELS[robotLevelIdx];
    const board = document.getElementById('robotBoard');
    const robotEl = document.getElementById('robotEl');
    if (board) {
      board.querySelectorAll('.cell--trail').forEach((c) => c.classList.remove('cell--trail'));
    }
    if (robotEl) {
      robotEl.classList.remove('face-left', 'shake', 'win');
    }
    robotPos = [lvl.start[0], lvl.start[1]];
    positionRobotElement();
  }

  function renderRobotSection() {
    buildRobotBoard();
    renderRobotProgram();
    const lvl = ROBOT_LEVELS[robotLevelIdx];
    const msgEl = document.getElementById('robotMsg');
    const nextBtn = document.getElementById('robotNext');
    if (nextBtn) nextBtn.hidden = true;
    renderTutaMessage(msgEl, t(lvl.hintKey));
  }

  function addRobotCommand(dir) {
    if (robotRunning) return;
    const msgEl = document.getElementById('robotMsg');
    if (robotCommands.length >= MAX_COMMANDS) {
      renderTutaMessage(msgEl, t('robot.tooMany', { n: MAX_COMMANDS }), 'warn');
      return;
    }
    robotCommands.push(dir);
    renderRobotProgram();
  }

  function runRobotProgram() {
    if (robotRunning) return;
    const msgEl = document.getElementById('robotMsg');
    const robotEl = document.getElementById('robotEl');
    const board = document.getElementById('robotBoard');
    const nextBtn = document.getElementById('robotNext');
    if (nextBtn) nextBtn.hidden = true;

    if (robotCommands.length === 0) {
      renderTutaMessage(msgEl, t('robot.empty'), 'warn');
      return;
    }

    resetRobotPositionOnly();
    robotRunning = true;
    const lvl = ROBOT_LEVELS[robotLevelIdx];
    let step = 0;

    function tick() {
      if (step >= robotCommands.length) {
        robotRunning = false;
        renderRobotProgram();
        if (robotPos[0] === lvl.goal[0] && robotPos[1] === lvl.goal[1]) {
          if (robotEl) robotEl.classList.add('win');
          const firstTime = !robotLevelsWon[robotLevelIdx];
          robotLevelsWon[robotLevelIdx] = true;
          unlockBadge('robot', 30);
          if (firstTime) {
            addXP(25);
            renderTutaMessage(msgEl, t('robot.win', { xp: 25 }), 'win');
          } else {
            renderTutaMessage(msgEl, t('robot.winAgain'), 'win');
          }
          if (robotLevelIdx < ROBOT_LEVELS.length - 1) {
            if (nextBtn) nextBtn.hidden = false;
          } else {
            renderTutaMessage(msgEl, t('robot.done'), 'win');
          }
        } else {
          renderTutaMessage(msgEl, t('robot.notReached'), 'warn');
        }
        return;
      }

      const dir = robotCommands[step];
      renderRobotProgram(step, -1);
      if (robotEl) {
        if (dir === 'left') robotEl.classList.add('face-left');
        if (dir === 'right') robotEl.classList.remove('face-left');
      }

      const [dx, dy] = DIR_DELTAS[dir];
      const nx = robotPos[0] + dx;
      const ny = robotPos[1] + dy;

      if (nx < 0 || nx > 4 || ny < 0 || ny > 4) {
        robotRunning = false;
        renderRobotProgram(-1, step);
        if (robotEl) robotEl.classList.add('shake');
        renderTutaMessage(msgEl, t('robot.out'), 'fail');
        return;
      }

      if (isRock(lvl, nx, ny)) {
        robotRunning = false;
        renderRobotProgram(-1, step);
        if (robotEl) robotEl.classList.add('shake');
        renderTutaMessage(msgEl, t('robot.crash'), 'fail');
        return;
      }

      const prevCell = board.querySelector(
        '.cell[data-x="' + robotPos[0] + '"][data-y="' + robotPos[1] + '"]'
      );
      if (prevCell) prevCell.classList.add('cell--trail');

      robotPos = [nx, ny];
      positionRobotElement();
      step++;
      setTimeout(tick, 390);
    }

    tick();
  }

  function applyAutopilotAlgorithm() {
    if (robotRunning) return;
    const lvl = ROBOT_LEVELS[robotLevelIdx];
    robotCommands = lvl.solution.slice();
    renderRobotProgram();
    const msgEl = document.getElementById('robotMsg');
    renderTutaMessage(msgEl, t('robot.autopilotHint'), 'win');
    setTimeout(runRobotProgram, 350);
  }

  /* =========================================================
     ГРА 2: Лабораторія Електроніки (LED + Закон Ома)
     ========================================================= */
  const LED_COLORS = {
    red: { hex: '#FF4D4D', vf: 2.0 },
    green: { hex: '#3CFF7A', vf: 2.2 },
    blue: { hex: '#4DA3FF', vf: 3.0 }
  };

  let circuitState = {
    res: '220',     // 'none' | '220' | '10000'
    color: 'red',   // 'red' | 'green' | 'blue'
    power: false,
    burnt: false
  };

  function renderCircuit() {
    const svg = document.getElementById('circuitSvg');
    const stage = document.getElementById('circuitStage');
    const resGroup = document.getElementById('cResistor');
    const shortWire = document.getElementById('cShort');
    const resLabel = document.getElementById('cResLabel');
    const powerBtn = document.getElementById('powerBtn');
    const repairBtn = document.getElementById('repairBtn');
    const formulaEl = document.getElementById('cFormula');
    const msgEl = document.getElementById('circuitMsg');
    if (!svg || !powerBtn || !formulaEl || !msgEl) return;

    const ledInfo = LED_COLORS[circuitState.color] || LED_COLORS.red;
    svg.style.setProperty('--led', ledInfo.hex);

    // Активні кнопки резисторів і кольорів
    document.querySelectorAll('#resOptions button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-res') === circuitState.res);
    });
    document.querySelectorAll('#colorOptions button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-color') === circuitState.color);
    });

    // Відображення резистора на схемі
    if (circuitState.res === 'none') {
      if (resGroup) resGroup.style.display = 'none';
      if (shortWire) shortWire.style.display = 'block';
    } else {
      if (resGroup) resGroup.style.display = 'block';
      if (shortWire) shortWire.style.display = 'none';
      if (resLabel) {
        resLabel.textContent = circuitState.res === '220' ? '220 Ω' : '10 kΩ';
      }
    }

    powerBtn.textContent = circuitState.power ? t('circuit.off') : t('circuit.on');
    powerBtn.classList.toggle('is-on', circuitState.power);
    if (repairBtn) repairBtn.hidden = !circuitState.burnt;

    svg.classList.remove('is-open', 'is-flowing', 'is-on', 'is-dim', 'is-hot', 'is-burnt');

    const vs = 5.0;
    const vf = ledInfo.vf;

    if (circuitState.burnt) {
      svg.classList.add('is-open', 'is-burnt');
      formulaEl.innerHTML = '<b>' + t('circuit.formula') + ':</b> R = 0 Ω → <b>I > 250 mA (MAX 20 mA) 💥</b>';
      renderTutaMessage(msgEl, t('circuit.burn'), 'fail');
      return;
    }

    if (!circuitState.power) {
      svg.classList.add('is-open');
      const rText = circuitState.res === 'none' ? '0 Ω' : circuitState.res + ' Ω';
      formulaEl.innerHTML = '<b>' + t('circuit.formula') + ':</b> U = 5V, R = ' + rText + ' → <b>I = 0 mA</b>';
      renderTutaMessage(msgEl, t('circuit.open'));
      return;
    }

    // Живлення увімкнено
    if (circuitState.res === 'none') {
      circuitState.burnt = true;
      circuitState.power = false;
      svg.classList.add('is-hot', 'is-burnt');
      const boom = document.getElementById('cBoom');
      if (boom) {
        boom.classList.remove('go');
        void boom.offsetWidth;
        boom.classList.add('go');
      }
      if (stage) {
        stage.classList.remove('shake');
        void stage.offsetWidth;
        stage.classList.add('shake');
      }
      if (repairBtn) repairBtn.hidden = false;
      powerBtn.textContent = t('circuit.on');
      powerBtn.classList.remove('is-on');
      formulaEl.innerHTML = '<b>' + t('circuit.formula') + ':</b> R = 0 Ω → <b>I > 250 mA 💥</b>';
      renderTutaMessage(msgEl, t('circuit.burn'), 'fail');
      return;
    }

    if (circuitState.res === '220') {
      const currentMa = (((vs - vf) / 220) * 1000).toFixed(1);
      svg.classList.add('is-flowing', 'is-on');
      formulaEl.innerHTML =
        '<b>' + t('circuit.formula') + ':</b> I = (5V − ' + vf.toFixed(1) + 'V) / 220 Ω = <b>' + currentMa + ' mA ✓</b>';
      const firstUnlock = unlockBadge('circuit', 30);
      renderTutaMessage(
        msgEl,
        firstUnlock ? t('circuit.ok', { xp: 30 }) : t('circuit.okAgain'),
        'win'
      );
    } else {
      const currentMa = (((vs - vf) / 10000) * 1000).toFixed(2);
      svg.classList.add('is-flowing', 'is-dim');
      formulaEl.innerHTML =
        '<b>' + t('circuit.formula') + ':</b> I = (5V − ' + vf.toFixed(1) + 'V) / 10000 Ω = <b>' + currentMa + ' mA (мало)</b>';
      renderTutaMessage(msgEl, t('circuit.dim'), 'warn');
    }
  }

  /* =========================================================
     ГРА 3: Детектив Коду / Code Review (2 раунди)
     ========================================================= */
  const BUG_CHALLENGES = [
    {
      file: 'game_collision.py',
      storyKey: 'bug.story1',
      hintKey: 'bug.hint1',
      winKey: 'bug.win1',
      bugLine: 3,
      lines: [
        '<span class="tk-kw">def</span> <span class="tk-fn">on_enemy_hit</span>(lives):',
        '    <span class="tk-fn">print</span>(<span class="tk-str">"Enemy touched player!"</span>)',
        '    lives = lives + <span class="tk-num">1</span>  <span class="tk-str"># update HP</span>',
        '    <span class="tk-kw">if</span> lives <= <span class="tk-num">0</span>:',
        '        <span class="tk-kw">return</span> <span class="tk-str">"GAME OVER"</span>',
        '    <span class="tk-kw">return</span> lives'
      ]
    },
    {
      file: 'drone_telemetry.py',
      storyKey: 'bug.story2',
      hintKey: 'bug.hint2',
      winKey: 'bug.win2',
      bugLine: 4,
      lines: [
        '<span class="tk-kw">def</span> <span class="tk-fn">calc_average</span>(nums):',
        '    total = <span class="tk-num">0</span>',
        '    <span class="tk-kw">for</span> x <span class="tk-kw">in</span> nums: total += x',
        '    <span class="tk-kw">return</span> total / <span class="tk-fn">len</span>(nums)'
      ]
    }
  ];

  let bugIdx = 0;
  let bugsSolved = [false, false];

  function renderBugChallenge() {
    const ch = BUG_CHALLENGES[bugIdx];
    const roundEl = document.getElementById('bugRound');
    const storyEl = document.getElementById('bugStory');
    const fileEl = document.getElementById('bugFile');
    const linesWrap = document.getElementById('bugLines');
    const msgEl = document.getElementById('bugMsg');
    const nextBtn = document.getElementById('bugNext');
    if (!roundEl || !storyEl || !linesWrap) return;

    roundEl.textContent = t('bug.round', {
      n: bugIdx + 1,
      total: BUG_CHALLENGES.length
    });
    storyEl.textContent = t(ch.storyKey);
    if (fileEl) fileEl.textContent = ch.file;
    if (nextBtn) nextBtn.hidden = true;
    msgEl.innerHTML = '';
    msgEl.className = 'tuta-msg';

    linesWrap.innerHTML = '';
    ch.lines.forEach((htmlLine, i) => {
      const lineNum = i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-line' + (bugsSolved[bugIdx] && lineNum === ch.bugLine ? ' is-right' : '');
      btn.innerHTML =
        '<span class="code-line__n">' + lineNum + '</span><span>' + htmlLine + '</span>';

      btn.addEventListener('click', () => {
        if (lineNum === ch.bugLine) {
          btn.classList.remove('is-wrong');
          btn.classList.add('is-right');
          const firstTime = !bugsSolved[bugIdx];
          bugsSolved[bugIdx] = true;
          if (firstTime) addXP(25);
          renderTutaMessage(msgEl, t(ch.winKey, { xp: 25 }), 'win');

          if (bugsSolved.every(Boolean)) {
            unlockBadge('bug', 30);
          }

          if (bugIdx < BUG_CHALLENGES.length - 1) {
            if (nextBtn) nextBtn.hidden = false;
          } else if (bugsSolved.every(Boolean)) {
            setTimeout(() => {
              renderTutaMessage(msgEl, t('bug.done'), 'win');
            }, 1400);
          }
        } else {
          btn.classList.remove('is-wrong');
          void btn.offsetWidth;
          btn.classList.add('is-wrong');
          renderTutaMessage(msgEl, t('bug.wrong'), 'warn');
        }
      });

      linesWrap.appendChild(btn);
    });
  }

  function updateGameTabChecks() {
    const map = {
      robot: state.badges.robot,
      circuit: state.badges.circuit,
      bug: state.badges.bug
    };
    document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
      const key = tab.getAttribute('data-tab');
      tab.classList.toggle('is-done', !!map[key]);
    });
  }

  /* =========================================================
     КУРСИ (НАПРЯМИ) + ЕКСПРЕС-КВІЗ (3 ПИТАННЯ)
     ========================================================= */
  /* Брендбук треків TutaCode: вік, фірмові кольори (c1/c2/c3) та графічний мотив.
     motif → CSS-клас .track--<motif> (фоновий патерн) + гліф в іконці. */
  const TRACKS_META = [
    {
      id: 'logic',
      motif: 'blocks',      // пазли та конструктор (Logo Blocks)
      glyph: '🧩',
      c1: '#F66E11',        // Тёплый оранжевый
      c2: '#F9CE33',        // Солнечный лимон
      tutaBody: 'url(#botBody-logic)',
      tutaEar: '#C2410C',
      tutaAccent: '#F9CE33',
      tutaAntenna: '#F66E11',
      tutaEye: '#F9CE33',
      ages: '7–11',
      quests: 32,
      forAge: ['kid']
    },
    {
      id: 'gamedev',
      motif: 'voxel',       // ізометрія, воксели, ігрові артефакти
      glyph: '🎮',
      c1: '#DE4278',        // Малиновый (альт. #F44E6B)
      c2: '#D300C5',        // Фиолетовый
      c3: '#F44E6B',
      tutaBody: 'url(#botBody-gamedev)',
      tutaEar: '#86198F',
      tutaAccent: '#F44E6B',
      tutaAntenna: '#DE4278',
      tutaEye: '#38BDF8',
      ages: '8–14',
      quests: 40,
      forAge: ['kid']
    },
    {
      id: 'web',
      motif: 'grid',        // модульна сітка, теги < />
      glyph: '</>',
      c1: '#00B6EF',        // Брендовый циан
      c2: '#2563EB',        // Электрический синий
      tutaBody: 'url(#botBody-web)',
      tutaEar: '#1E40AF',
      tutaAccent: '#00B6EF',
      tutaAntenna: '#38BDF8',
      tutaEye: '#00B6EF',
      ages: '12–17',
      quests: 45,
      forAge: ['teen']
    },
    {
      id: 'python',
      motif: 'nodes',       // графи, нейромережі, >_ та { }
      glyph: '>_',
      c1: '#22C55E',        // Изумрудный
      c2: '#123727',        // Хвойный
      c3: '#204056',        // Сланцевый
      tutaBody: 'url(#botBody-python)',
      tutaEar: '#204056',
      tutaAccent: '#22C55E',
      tutaAntenna: '#22C55E',
      tutaEye: '#4ADE80',
      ages: '12–18',
      quests: 48,
      forAge: ['teen']
    }
  ];

  // Скидаємо застарілу рекомендацію зі старої версії треків (scratch/arduino/ai)
  if (state.recTrack && !TRACKS_META.some((m) => m.id === state.recTrack)) {
    state.recTrack = null;
    saveState();
  }

  function getTrackMeta(id) {
    return TRACKS_META.find((m) => m.id === id) || TRACKS_META[0];
  }

  function tutaStyleVars(meta) {
    return (
      '--c1:' + meta.c1 +
      ';--c2:' + meta.c2 +
      ';--c3:' + (meta.c3 || meta.c2) +
      ';--tuta-body:' + (meta.tutaBody || 'url(#botBody)') +
      ';--tuta-ear:' + (meta.tutaEar || meta.c2) +
      ';--tuta-accent:' + (meta.tutaAccent || meta.c1) +
      ';--tuta-antenna:' + (meta.tutaAntenna || meta.c1) +
      ';--tuta-eye:' + (meta.tutaEye || '#22D3EE')
    );
  }

  function trackIconHtml(meta) {
    const isText = /^[<>{}\w]/.test(meta.glyph);
    return (
      '<div class="track__icon track__icon--brand' + (isText ? ' is-mono' : '') + '" ' +
      'style="' + tutaStyleVars(meta) + '" aria-hidden="true">' +
      '<svg class="track__motif-svg"><use href="#motif-' + meta.motif + '"/></svg>' +
      '<span class="track__glyph">' + meta.glyph.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
      '<svg class="track__tuta"><use href="#tuta-bot"/></svg>' +
      '</div>'
    );
  }

  let quizStep = -1; // -1 = стартовий екран, 0..2 = питання, 3 = результат
  let quizAnswers = [];

  function renderQuiz() {
    const box = document.getElementById('quiz');
    if (!box) return;

    const questions = t('quiz.q');
    const total = Array.isArray(questions) ? questions.length : 3;

    if (quizStep === -1) {
      box.innerHTML =
        '<div class="quiz__top">' +
        '  <svg aria-hidden="true"><use href="#tuta-bot"/></svg>' +
        '  <div>' +
        '    <h3>' + t('quiz.title') + '</h3>' +
        '    <p>' + t('quiz.sub') + '</p>' +
        '  </div>' +
        '</div>' +
        '<button type="button" class="btn btn--primary" id="quizStartBtn">' + t('quiz.start') + '</button>';
      const startBtn = document.getElementById('quizStartBtn');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          quizStep = 0;
          quizAnswers = [];
          renderQuiz();
        });
      }
      return;
    }

    if (quizStep >= 0 && quizStep < total) {
      const qObj = questions[quizStep];
      const pct = Math.round(((quizStep + 1) / total) * 100);
      let optsHtml = '';
      qObj.a.forEach((ansText, idx) => {
        optsHtml +=
          '<button type="button" class="quiz__opt" data-qopt="' + idx + '">' + ansText + '</button>';
      });

      box.innerHTML =
        '<div class="quiz__step">' + t('quiz.step', { n: quizStep + 1, total: total }) + '</div>' +
        '<div class="quiz__progress"><i style="width:' + pct + '%"></i></div>' +
        '<h3>' + qObj.q + '</h3>' +
        '<div class="quiz__options">' + optsHtml + '</div>';

      box.querySelectorAll('[data-qopt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const choice = parseInt(btn.getAttribute('data-qopt'), 10);
          quizAnswers.push(choice);
          quizStep++;
          if (quizStep >= total) {
            const firstChoice = quizAnswers[0];
            // 0 гра → Геймдев · 1 робот/пристрій → Блоковий код (mBlock) · 2 ШІ → Python · 3 сайт → Web
            const mapTrack = ['gamedev', 'logic', 'python', 'web'][firstChoice] || 'logic';
            state.recTrack = mapTrack;
            saveState();
            unlockBadge('quiz', 25);
            renderTracks();
          }
          renderQuiz();
        });
      });
      return;
    }

    // Результат квізу
    const recId = state.recTrack || (state.age === 'kid' ? 'logic' : 'python');
    const meta = TRACKS_META.find((m) => m.id === recId) || TRACKS_META[0];
    const tr = t('tracks.items.' + meta.id);

    box.innerHTML =
      '<div class="quiz__step">' + t('quiz.result') + '</div>' +
      '<div class="quiz__result">' +
      '  ' + trackIconHtml(meta) +
      '  <div>' +
      '    <b>' + tr.name + '</b>' +
      '    <p>' + tr.desc + '</p>' +
      '  </div>' +
      '</div>' +
      '<div class="game__actions">' +
      '  <button type="button" class="btn btn--primary" data-open-signup>' + t('tracks.tryTrack') + '</button>' +
      '  <button type="button" class="btn btn--ghost" id="quizAgainBtn">' + t('quiz.again') + '</button>' +
      '</div>';

    const againBtn = document.getElementById('quizAgainBtn');
    if (againBtn) {
      againBtn.addEventListener('click', () => {
        quizStep = 0;
        quizAnswers = [];
        renderQuiz();
      });
    }
    bindSignupTriggers(box);
  }

  function renderTracks() {
    const grid = document.getElementById('tracksGrid');
    if (!grid) return;
    grid.innerHTML = '';

    TRACKS_META.forEach((meta) => {
      const tr = t('tracks.items.' + meta.id);
      const isRec =
        state.recTrack === meta.id ||
        (!state.recTrack && meta.forAge.includes(state.age));

      const card = document.createElement('article');
      card.className = 'track track--brand track--' + meta.motif + (isRec ? ' is-rec' : '');
      card.setAttribute('style', tutaStyleVars(meta));
      const tagsHtml = (tr.tags || []).map((tg) => '<span>' + tg + '</span>').join('');

      card.innerHTML =
        '<svg class="track__watermark" aria-hidden="true"><use href="#motif-' + meta.motif + '"/></svg>' +
        (isRec ? '<span class="track__ribbon">' + t('tracks.forYou') + '</span>' : '') +
        trackIconHtml(meta) +
        '<h3>' + tr.name + '</h3>' +
        '<div class="track__meta">' +
        '  <span class="chip chip--brand">' + t('tracks.years', { a: meta.ages }) + '</span>' +
        (tr.level ? '  <span class="chip">' + tr.level + '</span>' : '') +
        '  <span class="chip">' + t('tracks.quests', { n: meta.quests }) + '</span>' +
        '</div>' +
        '<p>' + tr.desc + '</p>' +
        '<div class="track__tags">' + tagsHtml + '</div>' +
        '<button type="button" class="btn btn--sm track__btn" data-open-signup>' + t('tracks.tryTrack') + '</button>';

      grid.appendChild(card);
    });

    bindSignupTriggers(grid);
  }

  /* =========================================================
     ТАРИФИ ПІДПИСКИ (UAH / EUR / USD + Щомісяця / На рік)
     ========================================================= */
  const PLAN_PRICES_USD = {
    free: 0,
    pro: 14,
    family: 22
  };

  function formatPrice(usdMonthly) {
    if (usdMonthly === 0) {
      if (state.currency === 'UAH') return '0 ₴';
      if (state.currency === 'EUR') return '0 €';
      return '$0';
    }
    const factor = state.billing === 'yearly' ? 0.75 : 1;
    const effectiveUsd = usdMonthly * factor;
    if (state.currency === 'UAH') {
      const uah = Math.round((effectiveUsd * 41.5) / 10) * 10;
      return uah + ' ₴';
    }
    if (state.currency === 'EUR') {
      const eur = Math.round(effectiveUsd * 0.92);
      return eur + ' €';
    }
    return '$' + Math.round(effectiveUsd);
  }

  function renderPricing() {
    const grid = document.getElementById('pricingGrid');
    if (!grid) return;

    document.querySelectorAll('#billingToggle button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-billing') === state.billing);
    });
    document.querySelectorAll('#currencyToggle button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-curr') === state.currency);
    });

    const plansOrder = [
      { id: 'free', popular: false, btnKey: 'pricing.chooseFree', btnClass: 'btn--ghost' },
      { id: 'pro', popular: true, btnKey: 'pricing.choosePro', btnClass: 'btn--primary' },
      { id: 'family', popular: false, btnKey: 'pricing.chooseFamily', btnClass: 'btn--ghost' }
    ];

    grid.innerHTML = '';
    plansOrder.forEach((p) => {
      const info = t('pricing.plans.' + p.id);
      const priceText = formatPrice(PLAN_PRICES_USD[p.id]);
      const periodText = p.id === 'free' ? t('pricing.freeForever') : t('pricing.perMonth');

      const article = document.createElement('article');
      article.className = 'plan' + (p.popular ? ' is-popular' : '');
      article.innerHTML =
        (p.popular ? '<span class="plan__badge">' + t('pricing.popular') + '</span>' : '') +
        '<h3>' + info.name + '</h3>' +
        '<p class="plan__desc">' + info.desc + '</p>' +
        '<div class="plan__price"><b>' + priceText + '</b><span>' + periodText + '</span></div>' +
        '<ul class="plan__list">' +
        '  <li>' + info.f1 + '</li>' +
        '  <li>' + info.f2 + '</li>' +
        '  <li>' + info.f3 + '</li>' +
        '  <li>' + info.f4 + '</li>' +
        '</ul>' +
        '<button type="button" class="btn ' + p.btnClass + ' btn--block" data-open-signup>' +
        t(p.btnKey) +
        '</button>';

      grid.appendChild(article);
    });

    bindSignupTriggers(grid);
  }

  /* =========================================================
     НАГОРОДИ ТА БЕЙДЖІ (#rewards)
     ========================================================= */
  const BADGES_META = [
    { id: 'robot', icon: '🤖' },
    { id: 'circuit', icon: '💡' },
    { id: 'bug', icon: '🐞' },
    { id: 'quiz', icon: '🧭' },
    { id: 'polyglot', icon: '🌐' },
    { id: 'explorer', icon: '🚀' }
  ];

  function renderRewards(justUnlockedKey) {
    const levelCard = document.getElementById('levelCard');
    const badgesGrid = document.getElementById('badgesGrid');
    if (!levelCard || !badgesGrid) return;

    const levels = t('rewards.levels');
    const lvlIdx = getLevelIndex(state.xp);
    const curName = Array.isArray(levels) ? levels[lvlIdx] : '';
    const isMax = lvlIdx >= LEVEL_THRESHOLDS.length - 1;
    const nextThreshold = isMax ? LEVEL_THRESHOLDS[lvlIdx] : LEVEL_THRESHOLDS[lvlIdx + 1];
    const prevThreshold = LEVEL_THRESHOLDS[lvlIdx];
    const progressPct = isMax
      ? 100
      : Math.min(
          100,
          Math.round(((state.xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
        );
    const nextText = isMax
      ? t('rewards.max')
      : t('rewards.toNext', {
          n: Math.max(0, nextThreshold - state.xp),
          name: levels[lvlIdx + 1]
        });

    const stepsHtml = (Array.isArray(levels) ? levels : [])
      .map((name, i) => '<span class="' + (i <= lvlIdx ? 'is-done' : '') + '">' + name + '</span>')
      .join('');

    levelCard.innerHTML =
      '<div class="level-card__top">' +
      '  <div>' +
      '    <small>' + t('rewards.level') + '</small>' +
      '    <div class="level-card__name">' + (lvlIdx + 1) + '. ' + curName + '</div>' +
      '  </div>' +
      '  <div class="level-card__xp">⚡ ' + state.xp + ' XP</div>' +
      '</div>' +
      '<div class="bar"><i style="width:' + progressPct + '%"></i></div>' +
      '<div class="level-card__next">' + nextText + '</div>' +
      '<div class="levels">' + stepsHtml + '</div>';

    badgesGrid.innerHTML = '';
    BADGES_META.forEach((b) => {
      const info = t('rewards.badges.' + b.id);
      const unlocked = !!state.badges[b.id];
      const div = document.createElement('div');
      div.className =
        'badge' +
        (unlocked ? ' is-on' : '') +
        (justUnlockedKey === b.id ? ' just-got' : '');
      div.innerHTML =
        '<div class="badge__icon" aria-hidden="true">' + b.icon + '</div>' +
        '<b>' + info.name + '</b>' +
        '<small>' + (unlocked ? t('rewards.got') : info.how) + '</small>';
      badgesGrid.appendChild(div);
    });
  }

  /* =========================================================
     БАТЬКАМ: FAQ
     ========================================================= */
  function renderFaq() {
    const list = document.getElementById('faqList');
    if (!list) return;
    const faqItems = t('parents.faq');
    list.innerHTML = '';
    if (!Array.isArray(faqItems)) return;

    faqItems.forEach((item, idx) => {
      const det = document.createElement('details');
      if (idx === 0) det.open = true;
      det.innerHTML = '<summary>' + item.q + '</summary><p>' + item.a + '</p>';
      list.appendChild(det);
    });
  }

  /* =========================================================
     МОДАЛКА РЕЄСТРАЦІЇ (Bottom Sheet)
     ========================================================= */
  function openSignup() {
    const sheet = document.getElementById('signupSheet');
    const formWrap = document.getElementById('signupFormWrap');
    const successWrap = document.getElementById('signupSuccess');
    if (!sheet) return;
    if (formWrap) formWrap.hidden = false;
    if (successWrap) successWrap.hidden = true;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeSignup() {
    const sheet = document.getElementById('signupSheet');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function bindSignupTriggers(root = document) {
    root.querySelectorAll('[data-open-signup]').forEach((btn) => {
      if (btn.dataset.boundSignup) return;
      btn.dataset.boundSignup = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openSignup();
      });
    });
  }

  /* =========================================================
     МАКЕТ ЗА СХЕМОЮ MIRO (#arena):
     Гейміфікація -> Короткі курси / Турніри -> Анонім-оцінка -> Поінти, знижка -> Основний курс
     ========================================================= */
  function getArenaStats() {
    const ar = state.arena;
    const sprintsCount = ['s1', 's2', 's3'].filter((k) => ar.sprintsDone[k]).length;
    const reviewsCount = ['w1', 'w2'].filter((k) => ar.reviewsDone[k]).length;
    const points =
      sprintsCount * 50 +
      (ar.tourSubmitted ? 100 : 0) +
      reviewsCount * 75;
    // Кожні 100 поінтів = 10% знижки, максимум 30%
    const discountPct = Math.min(30, Math.floor(points / 100) * 10);
    return { sprintsCount, reviewsCount, points, discountPct };
  }

  function setArenaTab(tabKey) {
    if (!['short', 'tour', 'review', 'main'].includes(tabKey)) return;
    state.arena.tab = tabKey;
    saveState();
    renderArena();
  }

  function renderArena() {
    const body = document.getElementById('arenaPhoneBody');
    if (!body) return;

    const ar = state.arena;
    ar.myTrack = normalizeArenaTrack(ar.myTrack);
    const activeMeta = getTrackMeta(ar.myTrack);
    const stats = getArenaStats();

    // 1. Синхронізація шапки телефона (з фірмовими кольорами активного треку)
    const trackBadge = document.getElementById('arenaUserTrackBadge');
    const ptsVal = document.getElementById('arenaPointsVal');
    const discVal = document.getElementById('arenaDiscountVal');
    const trackNames = t('arena.trackNames') || {};
    if (trackBadge) {
      trackBadge.textContent = trackNames[ar.myTrack] || ar.myTrack;
      trackBadge.style.setProperty('--c1', activeMeta.c1);
      trackBadge.style.setProperty('--c2', activeMeta.c2);
    }
    if (ptsVal) ptsVal.textContent = stats.points + ' pts';
    if (discVal) discVal.textContent = '-' + stats.discountPct + '%';

    // 2. Синхронізація схеми Miro (6 блоків)
    const statusShort = document.getElementById('statusShort');
    const statusTour = document.getElementById('statusTour');
    const statusReview = document.getElementById('statusReview');
    const statusDiscount = document.getElementById('statusDiscount');
    const statusMain = document.getElementById('statusMain');

    if (statusShort) statusShort.textContent = stats.sprintsCount + '/3';
    if (statusTour) statusTour.textContent = ar.tourSubmitted ? '✓ #482' : '⚔️';
    if (statusReview) statusReview.textContent = stats.reviewsCount + '/2';
    if (statusDiscount) statusDiscount.textContent = '-' + stats.discountPct + '%';
    if (statusMain) statusMain.textContent = stats.sprintsCount > 0 || stats.discountPct > 0 ? '🔓' : '🎯';

    const nodeShort = document.getElementById('miroNodeShort');
    const nodeTour = document.getElementById('miroNodeTour');
    const nodeReview = document.getElementById('miroNodeReview');
    const nodeDiscount = document.getElementById('miroNodeDiscount');
    const nodeMain = document.getElementById('miroNodeMain');

    if (nodeShort) nodeShort.classList.toggle('is-done', stats.sprintsCount === 3);
    if (nodeTour) nodeTour.classList.toggle('is-done', !!ar.tourSubmitted);
    if (nodeReview) nodeReview.classList.toggle('is-done', stats.reviewsCount === 2);
    if (nodeDiscount) nodeDiscount.classList.toggle('is-done', stats.discountPct > 0);
    if (nodeMain) nodeMain.classList.toggle('is-done', stats.sprintsCount === 3 && stats.discountPct > 0);

    document.querySelectorAll('.miro-node[data-miro-node]').forEach((node) => {
      node.classList.toggle('is-active', node.getAttribute('data-miro-node') === ar.tab);
    });

    // 3. Синхронізація вкладок телефона
    document.querySelectorAll('.phone-tab[data-arena-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-arena-tab') === ar.tab);
    });

    // 4. Рендер активного екрана всередині телефона
    if (ar.tab === 'short') {
      const items = t('arena.short.items') || [];
      let cardsHtml = '';
      items.forEach((item) => {
        const done = !!ar.sprintsDone[item.id];
        const sMeta = getTrackMeta(item.trackId || 'logic');
        cardsHtml +=
          '<div class="arena-card arena-card--brand' + (done ? ' is-done' : '') + '" style="' + tutaStyleVars(sMeta) + '">' +
          '  <svg class="arena-card__watermark" aria-hidden="true"><use href="#motif-' + sMeta.motif + '"/></svg>' +
          '  <div class="arena-card__top">' +
          '    <span class="arena-card__tag">' + item.tag + '</span>' +
          '    <span class="chip">' + (done ? '✓ +50 pts' : '+50 pts') + '</span>' +
          '  </div>' +
          '  <h4>' + item.name + '</h4>' +
          '  <p>' + item.desc + '</p>' +
          '  <button type="button" class="btn ' + (done ? 'btn--ghost' : 'btn--primary') + ' btn--sm" data-sprint-btn="' + item.id + '">' +
          (done ? t('arena.short.btnDone') : t('arena.short.btnTake')) +
          '  </button>' +
          '</div>';
      });

      body.innerHTML =
        '<div class="arena-screen-head">' +
        '  <div class="arena-card__top">' +
        '    <span class="arena-screen-badge">' + t('arena.short.badge') + '</span>' +
        '    <span class="chip">' + t('arena.short.progress', { done: stats.sprintsCount }) + '</span>' +
        '  </div>' +
        '  <h3>' + t('arena.short.title') + '</h3>' +
        '  <p>' + t('arena.short.desc') + '</p>' +
        '</div>' +
        cardsHtml +
        '<div class="game__actions">' +
        '  <button type="button" class="btn btn--primary btn--sm" data-go-arena="main">' + t('arena.short.goToMain') + '</button>' +
        '  <button type="button" class="btn btn--ghost btn--sm" data-go-arena="tour">' + t('arena.short.goToTour') + '</button>' +
        '</div>';

      body.querySelectorAll('[data-sprint-btn]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-sprint-btn');
          if (!ar.sprintsDone[id]) {
            ar.sprintsDone[id] = true;
            saveState();
            addXP(20);
            renderArena();
          }
        });
      });
    } else if (ar.tab === 'tour') {
      const trackBtnsHtml = TRACKS_META
        .map((m) => {
          const label = (trackNames[m.id] || m.id).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return (
            '<button type="button" class="track-pill-btn' +
            (ar.myTrack === m.id ? ' is-active' : '') +
            '" style="--c1:' + m.c1 + ';--c2:' + m.c2 + '" data-set-track="' +
            m.id +
            '">' +
            label +
            '</button>'
          );
        })
        .join('');

      const taskText = t('arena.tour.tasks.' + ar.myTrack);
      const ansList = t('arena.tour.ansOptions.' + ar.myTrack) || [];
      const ansHtml = ansList
        .map(
          (opt, idx) =>
            '<button type="button" class="tour-ans-btn' +
            (ar.tourAnswer === idx ? ' is-selected' : '') +
            '" data-tour-ans="' +
            idx +
            '">' +
            opt.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
            '</button>'
        )
        .join('');

      const showWrongHint = !ar.tourSubmitted && ar.tourAnswer !== 0;

      body.innerHTML =
        '<div class="arena-screen-head">' +
        '  <span class="arena-screen-badge">' + t('arena.tour.badge') + '</span>' +
        '  <h3>' + t('arena.tour.title') + '</h3>' +
        '  <p>' + t('arena.tour.desc') + '</p>' +
        '</div>' +
        '<div class="arena-card">' +
        '  <span class="arena-card__tag">' + t('arena.tour.chooseTrack') + '</span>' +
        '  <div class="track-pills track-pills--4">' + trackBtnsHtml + '</div>' +
        '</div>' +
        '<div class="arena-card arena-card--brand' + (ar.tourSubmitted ? ' is-done' : '') + '" style="' + tutaStyleVars(activeMeta) + '">' +
        '  <svg class="arena-card__watermark" aria-hidden="true"><use href="#motif-' + activeMeta.motif + '"/></svg>' +
        '  <div class="arena-card__top">' +
        '    <span class="arena-card__tag">' + t('arena.tour.taskLabel') + '</span>' +
        '    <span class="chip chip--brand">' + activeMeta.ages + '</span>' +
        '  </div>' +
        '  <h4>' + taskText + '</h4>' +
        '  <div class="tour-ans-list">' + ansHtml + '</div>' +
        (showWrongHint
          ? '<div class="tuta-msg is-warn"><svg class="tuta-msg__ava" aria-hidden="true"><use href="#tuta-bot"/></svg><div>' + t('arena.tour.wrongHint') + '</div></div>'
          : '') +
        (ar.tourSubmitted
          ? '<div class="tuta-msg is-win"><svg class="tuta-msg__ava" aria-hidden="true"><use href="#tuta-bot"/></svg><div>' + t('arena.tour.submittedBadge') + '</div></div>'
          : '<button type="button" class="btn btn--primary btn--sm" id="submitTourWorkBtn">' +
            t('arena.tour.submitBtn') +
            '</button>') +
        '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm btn--block" data-go-arena="review">' +
        t('arena.tour.nextReviewBtn') +
        '</button>';

      body.querySelectorAll('[data-set-track]').forEach((btn) => {
        btn.addEventListener('click', () => {
          ar.myTrack = normalizeArenaTrack(btn.getAttribute('data-set-track'));
          ar.tourAnswer = 0;
          saveState();
          renderArena();
        });
      });

      body.querySelectorAll('[data-tour-ans]').forEach((btn) => {
        btn.addEventListener('click', () => {
          ar.tourAnswer = parseInt(btn.getAttribute('data-tour-ans'), 10);
          saveState();
          renderArena();
        });
      });

      const subBtn = document.getElementById('submitTourWorkBtn');
      if (subBtn) {
        subBtn.addEventListener('click', () => {
          if (!ar.tourSubmitted) {
            ar.tourSubmitted = true;
            saveState();
            addXP(30);
            burstConfetti(20);
            renderArena();
          }
        });
      }
    } else if (ar.tab === 'review') {
      const pool = t('arena.review.pool');
      let cards = [];
      if (pool && typeof pool === 'object') {
        const curIdx = Math.max(0, TRACKS_META.findIndex((m) => m.id === ar.myTrack));
        const otherTracks = [
          TRACKS_META[(curIdx + 1) % TRACKS_META.length],
          TRACKS_META[(curIdx + 2) % TRACKS_META.length]
        ];
        cards = otherTracks.map((m, idx) => {
          const item = pool[m.id] || {};
          return {
            id: idx === 0 ? 'w1' : 'w2',
            trackId: m.id,
            anonId: item.anonId || ('#' + (700 + idx)),
            direction: item.direction || m.id,
            workTitle: item.workTitle || '',
            preview: item.preview || '',
            note: item.note || ''
          };
        });
      } else {
        cards = t('arena.review.cards') || [];
      }

      let cardsHtml = '';

      cards.forEach((c) => {
        const done = !!ar.reviewsDone[c.id];
        const cMeta = getTrackMeta(c.trackId || 'logic');
        const r = ar.ratings[c.id] || { idea: 5, logic: 4, cool: 5 };
        const makeStars = (critKey) => {
          let s = '';
          for (let i = 1; i <= 5; i++) {
            s +=
              '<button type="button" class="star-btn' +
              (i <= r[critKey] ? ' is-on' : '') +
              '" data-rate-card="' +
              c.id +
              '" data-rate-crit="' +
              critKey +
              '" data-rate-val="' +
              i +
              '">' +
              i +
              '</button>';
          }
          return s;
        };

        cardsHtml +=
          '<div class="arena-card arena-card--brand' + (done ? ' is-done' : '') + '" style="' + tutaStyleVars(cMeta) + '">' +
          '  <svg class="arena-card__watermark" aria-hidden="true"><use href="#motif-' + cMeta.motif + '"/></svg>' +
          '  <div class="arena-card__top">' +
          '    <span class="arena-card__tag">🕵️ ' + c.anonId + '</span>' +
          '    <span class="chip chip--brand">' + c.direction.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
          '  </div>' +
          '  <h4>' + c.workTitle + '</h4>' +
          '  <p>' + c.preview + '</p>' +
          (c.note ? '  <p class="arena-card__note">' + c.note + '</p>' : '') +
          '  <div class="rating-grid">' +
          '    <div class="rating-row"><span>' + t('arena.review.critIdea') + '</span><div class="rating-stars">' + makeStars('idea') + '</div></div>' +
          '    <div class="rating-row"><span>' + t('arena.review.critLogic') + '</span><div class="rating-stars">' + makeStars('logic') + '</div></div>' +
          '    <div class="rating-row"><span>' + t('arena.review.critCool') + '</span><div class="rating-stars">' + makeStars('cool') + '</div></div>' +
          '  </div>' +
          '  <button type="button" class="btn ' + (done ? 'btn--ghost' : 'btn--primary') + ' btn--sm" data-confirm-review="' + c.id + '">' +
          (done ? t('arena.review.ratedBtn') : t('arena.review.rateBtn')) +
          '  </button>' +
          '</div>';
      });

      body.innerHTML =
        '<div class="arena-screen-head">' +
        '  <span class="arena-screen-badge">' + t('arena.review.badge') + '</span>' +
        '  <h3>' + t('arena.review.title') + '</h3>' +
        '  <p>' + t('arena.review.rule') + '</p>' +
        '</div>' +
        cardsHtml +
        '<button type="button" class="btn btn--primary btn--sm btn--block" data-go-arena="main">' +
        t('arena.review.toDiscountBtn') +
        '</button>';

      body.querySelectorAll('[data-rate-card]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cId = btn.getAttribute('data-rate-card');
          const crit = btn.getAttribute('data-rate-crit');
          const val = parseInt(btn.getAttribute('data-rate-val'), 10);
          if (!ar.ratings[cId]) ar.ratings[cId] = { idea: 5, logic: 5, cool: 5 };
          ar.ratings[cId][crit] = val;
          saveState();
          renderArena();
        });
      });

      body.querySelectorAll('[data-confirm-review]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cId = btn.getAttribute('data-confirm-review');
          if (!ar.reviewsDone[cId]) {
            ar.reviewsDone[cId] = true;
            saveState();
            addXP(25);
            renderArena();
          }
        });
      });
    } else if (ar.tab === 'main') {
      const baseUah = 580;
      const finalUah = Math.round(baseUah * (1 - stats.discountPct / 100));

      body.innerHTML =
        '<div class="arena-screen-head">' +
        '  <span class="arena-screen-badge">' + t('arena.main.badge') + '</span>' +
        '  <h3>' + t('arena.main.title') + '</h3>' +
        '  <p>' + t('arena.main.desc') + '</p>' +
        '</div>' +
        '<div class="wallet-box">' +
        '  <div class="wallet-stat">' +
        '    <small>' + t('arena.main.ptsLabel') + '</small>' +
        '    <strong>🏆 ' + stats.points + ' pts</strong>' +
        '  </div>' +
        '  <div class="wallet-stat">' +
        '    <small>' + t('arena.main.discLabel') + '</small>' +
        '    <strong>🏷️ -' + stats.discountPct + '%</strong>' +
        '  </div>' +
        '</div>' +
        '<div class="arena-card is-done">' +
        '  <span class="arena-card__tag">' + t('arena.main.formulaNote') + '</span>' +
        '  <h4>' + t('arena.main.mainCourseTitle') + '</h4>' +
        '  <p>' +
        (stats.sprintsCount > 0 ? t('arena.main.courseStatusReady') : t('arena.main.courseStatusPending')) +
        '  </p>' +
        '  <div class="price-compare">' +
        '    <div><small>' + t('arena.main.oldPriceLabel') + '</small><br><s>' + baseUah + ' ₴ / міс</s></div>' +
        '    <div style="text-align:right"><small>' + t('arena.main.newPriceLabel') + '</small><br><b>' + finalUah + ' ₴ / міс</b></div>' +
        '  </div>' +
        '  <button type="button" class="btn btn--primary btn--block" data-open-signup>' +
        t('arena.main.claimBtn') +
        '  </button>' +
        '</div>' +
        '<button type="button" class="btn btn--text btn--sm" id="resetArenaBtn">' +
        t('arena.main.resetBtn') +
        '</button>';

      bindSignupTriggers(body);
      const resetArenaBtn = document.getElementById('resetArenaBtn');
      if (resetArenaBtn) {
        resetArenaBtn.addEventListener('click', () => {
          state.arena = JSON.parse(JSON.stringify(DEFAULT_STATE.arena));
          saveState();
          renderArena();
        });
      }
    }

    body.querySelectorAll('[data-go-arena]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setArenaTab(btn.getAttribute('data-go-arena'));
      });
    });
  }

  /* =========================================================
     ПОВНИЙ РЕРЕНДЕР УСІХ СЕКЦІЙ
     ========================================================= */
  function rerenderAll() {
    applyStaticTranslations();
    renderArena();
    renderChatDemo();
    renderRobotSection();
    renderCircuit();
    renderBugChallenge();
    renderQuiz();
    renderTracks();
    renderPricing();
    renderRewards();
    renderFaq();
    updateGameTabChecks();
  }

  /* =========================================================
     ІНІЦІАЛІЗАЦІЯ ПОДІЙ
     ========================================================= */
  function initEvents() {
    // Мова UA / RU
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
    });

    // Вік 9-12 / 15+
    document.querySelectorAll('[data-age-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setAge(btn.getAttribute('data-age-btn')));
    });

    // Тема Dark / Light
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Режим рамки смартфона на ПК
    const phoneBtn = document.getElementById('phoneFrameToggle');
    if (phoneBtn) phoneBtn.addEventListener('click', togglePhonePreview);

    // Керування макетом Miro (#arena): клік по блоках схеми та вкладках телефона
    document.querySelectorAll('.miro-node[data-miro-node]').forEach((node) => {
      node.addEventListener('click', () => {
        setArenaTab(node.getAttribute('data-miro-node'));
        const phoneEl = document.getElementById('phoneArenaMockup');
        if (phoneEl && window.innerWidth < 768) {
          phoneEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
    document.querySelectorAll('.phone-tab[data-arena-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        setArenaTab(tab.getAttribute('data-arena-tab'));
      });
    });

    // Вкладки міні-ігор
    const tabs = document.querySelectorAll('.tab[data-tab]');
    const panels = document.querySelectorAll('.game[data-panel]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        tabs.forEach((tEl) => tEl.classList.toggle('is-active', tEl === tab));
        panels.forEach((pEl) => {
          const match = pEl.getAttribute('data-panel') === target;
          pEl.hidden = !match;
        });
        if (target === 'robot') {
          requestAnimationFrame(positionRobotElement);
        }
      });
    });
    if (tabs[0]) tabs[0].classList.add('is-active');

    // Керування Роботом
    document.querySelectorAll('.dpad__btn[data-dir]').forEach((btn) => {
      btn.addEventListener('click', () => addRobotCommand(btn.getAttribute('data-dir')));
    });
    const runBtn = document.getElementById('robotRun');
    const resetBtn = document.getElementById('robotReset');
    const clearBtn = document.getElementById('robotClear');
    const nextRobotBtn = document.getElementById('robotNext');
    const autopilotBtn = document.getElementById('robotAutopilotBtn');

    if (runBtn) runBtn.addEventListener('click', runRobotProgram);
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (robotRunning) return;
        resetRobotPositionOnly();
        renderRobotProgram();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (robotRunning) return;
        robotCommands = [];
        resetRobotPositionOnly();
        renderRobotProgram();
      });
    }
    if (nextRobotBtn) {
      nextRobotBtn.addEventListener('click', () => {
        robotLevelIdx = (robotLevelIdx + 1) % ROBOT_LEVELS.length;
        robotCommands = [];
        renderRobotSection();
      });
    }
    if (autopilotBtn) {
      autopilotBtn.addEventListener('click', applyAutopilotAlgorithm);
    }

    window.addEventListener('resize', () => {
      requestAnimationFrame(positionRobotElement);
    });

    // Керування Схемою
    document.querySelectorAll('#resOptions button').forEach((btn) => {
      btn.addEventListener('click', () => {
        circuitState.res = btn.getAttribute('data-res');
        renderCircuit();
      });
    });
    document.querySelectorAll('#colorOptions button').forEach((btn) => {
      btn.addEventListener('click', () => {
        circuitState.color = btn.getAttribute('data-color');
        renderCircuit();
      });
    });
    const powerBtn = document.getElementById('powerBtn');
    if (powerBtn) {
      powerBtn.addEventListener('click', () => {
        if (circuitState.burnt) return;
        circuitState.power = !circuitState.power;
        renderCircuit();
      });
    }
    const repairBtn = document.getElementById('repairBtn');
    if (repairBtn) {
      repairBtn.addEventListener('click', () => {
        circuitState.burnt = false;
        circuitState.power = false;
        if (circuitState.res === 'none') circuitState.res = '220';
        renderCircuit();
      });
    }

    // Керування грою «Знайди баг»
    const bugHintBtn = document.getElementById('bugHintBtn');
    const bugNextBtn = document.getElementById('bugNext');
    if (bugHintBtn) {
      bugHintBtn.addEventListener('click', () => {
        const ch = BUG_CHALLENGES[bugIdx];
        const msgEl = document.getElementById('bugMsg');
        renderTutaMessage(msgEl, t(ch.hintKey));
      });
    }
    if (bugNextBtn) {
      bugNextBtn.addEventListener('click', () => {
        bugIdx = (bugIdx + 1) % BUG_CHALLENGES.length;
        renderBugChallenge();
      });
    }

    // Керування Тарифами (Період і Валюта)
    document.querySelectorAll('#billingToggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.billing = btn.getAttribute('data-billing');
        saveState();
        renderPricing();
      });
    });
    document.querySelectorAll('#currencyToggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.currency = btn.getAttribute('data-curr');
        saveState();
        renderPricing();
      });
    });

    // Реєстрація (Bottom Sheet)
    bindSignupTriggers(document);
    document.querySelectorAll('[data-close-signup]').forEach((el) => {
      el.addEventListener('click', closeSignup);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSignup();
    });

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let valid = true;
        signupForm.querySelectorAll('.field').forEach((f) => {
          const inp = f.querySelector('input[required]');
          if (inp && !inp.value.trim()) {
            f.classList.add('is-invalid');
            valid = false;
          } else {
            f.classList.remove('is-invalid');
          }
        });
        if (!valid) return;

        const formWrap = document.getElementById('signupFormWrap');
        const successWrap = document.getElementById('signupSuccess');
        if (formWrap) formWrap.hidden = true;
        if (successWrap) successWrap.hidden = false;
        addXP(50);
        burstConfetti(35);
      });
    }

    // Плавна поява секцій (.reveal) + підсвітка активного пункту меню + бейдж Дослідника у футері
    if ('IntersectionObserver' in window) {
      const revealObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add('is-in');
              revealObs.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));

      const footerEl = document.getElementById('footer');
      if (footerEl) {
        const footerObs = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) unlockBadge('explorer', 20);
            });
          },
          { threshold: 0.3 }
        );
        footerObs.observe(footerEl);
      }

      const navSections = ['home', 'arena', 'how', 'play', 'tracks', 'pricing', 'rewards', 'parents'];
      const secObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              const id = en.target.id;
              document.querySelectorAll('[data-nav]').forEach((link) => {
                link.classList.toggle('is-active', link.getAttribute('data-nav') === id);
              });
            }
          });
        },
        { rootMargin: '-35% 0px -55% 0px' }
      );
      navSections.forEach((id) => {
        const sec = document.getElementById(id);
        if (sec) secObs.observe(sec);
      });
    } else {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    }
  }

  /* ---------------- Старт застосунку ---------------- */
  syncHeaderControls();
  rerenderAll();
  initEvents();
})();

