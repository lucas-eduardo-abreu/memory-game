// Jogo da Memória — preload por dificuldade, pausa, dica, som e recordes
// ============================== CONFIG ==============================
const CONFIG = {
  ASSET_BASE: "assets",
  EXT: "png", // troque para "jpg" se preferir
  DIFFS: {
    easy:   { label: "Fácil",   pairs: 5,  cols: 5, rows: 2, boardClass: "board--easy"   },
    medium: { label: "Médio",   pairs: 10, cols: 5, rows: 4, boardClass: "board--medium" },
    hard:   { label: "Difícil", pairs: 20, cols: 8, rows: 5, boardClass: "board--hard"   },
  },
  HINT_DURATION_MS: 2000,
  FLIP_BACK_MS: 650,
};

// ============================== DOM HELPERS ==============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const screens = {
  loading: $("#screen-loading"),
  start:   $("#screen-start"),
  select:  $("#screen-select"),
  game:    $("#screen-game"),
  win:     $("#screen-win"),
};
function showScreen(name){
  $$(".screen").forEach(s => s.classList.remove("screen--active"));
  screens[name].classList.add("screen--active");
}

const boardEl = $("#board");
const hud = {
  difficulty: $("#hud-difficulty"),
  pairs: $("#hud-pairs"),
  moves: $("#hud-moves"),
  time: $("#hud-time"),
  best: $("#hud-best"),
};

const pauseOverlay = $("#pause-overlay");
const loaderBar = $("#loader-bar");
const loaderText = $("#loader-text");
const btnSkipLoading = $("#btn-skip-loading");

const btnStart = $("#btn-start");
const btnBackStart = $("#btn-back-start");
const btnExit = $("#btn-exit");
const btnRestart = $("#btn-restart");
const btnPlayAgain = $("#btn-play-again");
const btnGoMenu = $("#btn-go-menu");
const btnPause = $("#btn-pause");
const btnHint = $("#btn-hint");
const btnMute = $("#btn-mute");

// ============================== STATE ==============================
let state = {
  diffKey: null,
  totalPairs: 0,
  foundPairs: 0,
  firstCard: null,
  lock: false,
  moves: 0,
  timerId: null,
  startTs: 0,
  paused: false,
  hintUsed: false,
  mute: false,
};

// ============================== STORAGE (recordes) ==============================
const LS_KEY = "memory-records-v1";
function loadRecords(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveRecords(records){
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}
function getBest(diffKey){
  const rec = loadRecords()[diffKey];
  return rec || null;
}
function setBest(diffKey, moves, elapsedSec){
  const recs = loadRecords();
  const current = recs[diffKey];
  if (!current || elapsedSec < current.timeSec || (elapsedSec === current.timeSec && moves < current.moves)) {
    recs[diffKey] = { moves, timeSec: elapsedSec };
    saveRecords(recs);
    return true;
  }
  return false;
}
function fmtTime(sec){
  const mm = String(Math.floor(sec/60)).padStart(2,"0");
  const ss = String(sec%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

// ============================== SONS (WebAudio) ==============================
let audioCtx = null;
function beep(freq=880, ms=70, vol=0.03){
  if (state.mute) return;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return; }
  }
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(() => { o.stop(); }, ms);
}
const sfx = {
  flip: () => beep(600, 45, 0.02),
  match: () => beep(920, 90, 0.035),
  nope: () => { beep(200, 60, 0.03); setTimeout(()=>beep(180, 60, 0.03), 70); },
  win: () => { [880, 1040, 1240].forEach((f, i)=>setTimeout(()=>beep(f, 90, 0.04), i*120)); }
};

// ============================== TIMER ==============================
function startTimer(){
  state.startTs = Date.now();
  state.timerId = setInterval(() => {
    const s = Math.floor((Date.now() - state.startTs)/1000);
    hud.time.textContent = fmtTime(s);
  }, 250);
}
function stopTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}
function pauseTimer(){
  if (!state.timerId) return;
  stopTimer();
}
function resumeTimer(){
  if (state.timerId || !state.paused) return;
  const elapsed = parseTime(hud.time.textContent);
  state.startTs = Date.now() - elapsed*1000;
  startTimer();
}
function parseTime(t="00:00"){
  const [mm, ss] = t.split(":").map(n=>parseInt(n,10)||0);
  return mm*60 + ss;
}

// ============================== ASSETS / PRELOAD (por dificuldade) ==============================
function buildUrlsFor(diffKey){
  const urls = [];
  const pairs = CONFIG.DIFFS[diffKey].pairs;
  for (let i=1;i<=pairs;i++){
    urls.push(`${CONFIG.ASSET_BASE}/${diffKey}/${i}.${CONFIG.EXT}`);
  }
  return urls;
}
async function preloadFor(diffKey, onProgress){
  const urls = buildUrlsFor(diffKey);
  let done = 0;
  const total = urls.length;
  const loadOne = (src)=> new Promise((resolve)=>{
    const img = new Image();
    img.onload = img.onerror = ()=>resolve();
    img.src = src;
  });
  for (const u of urls){
    await loadOne(u);
    done++;
    onProgress && onProgress(done, total);
  }
}

// ============================== IMG HELPER (fallback + log) ==============================
function createImg(src, key) {
  const img = document.createElement("img");
  img.alt = `Carta ${key}`;
  img.src = src;

  img.addEventListener("error", () => {
    console.error("[MEMORY] Falha ao carregar imagem:", src);

    const fallback = document.createElement("div");
    fallback.style.cssText = `
      position:absolute;inset:0;display:grid;place-items:center;
      background:#2b2f3a;color:#ff7777;font-weight:900;
      font-family:system-ui,Segoe UI,Roboto,Ubuntu,monospace;
    `;
    fallback.textContent = "IMG 404";
    img.replaceWith(fallback);
  });

  return img;
}

// ============================== DECK / BOARD ==============================
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function buildDeck(diffKey){
  const cfg = CONFIG.DIFFS[diffKey];
  const list = [];
  for(let i=1;i<=cfg.pairs;i++){
    const src = `${CONFIG.ASSET_BASE}/${diffKey}/${i}.${CONFIG.EXT}`;
    list.push({ key: i, src });
    list.push({ key: i, src });
  }
  return shuffle(list);
}
function renderBoard(diffKey){
  const cfg = CONFIG.DIFFS[diffKey];
  Object.assign(state, {
    diffKey, totalPairs: cfg.pairs, foundPairs: 0, firstCard: null,
    lock: false, moves: 0, paused: false, hintUsed: false,
  });
  hud.difficulty.textContent = cfg.label;
  hud.pairs.textContent = `0/${cfg.pairs}`;
  hud.moves.textContent = `Movimentos: 0`;
  hud.time.textContent = `00:00`;
  updateBestHud();

  // limpar
  boardEl.className = "board " + cfg.boardClass;
  boardEl.innerHTML = "";
  boardEl.style.pointerEvents = "auto";

  const deck = buildDeck(diffKey);
  boardEl.setAttribute("role", "grid");
  boardEl.setAttribute("aria-rowcount", cfg.rows);
  boardEl.setAttribute("aria-colcount", cfg.cols);

  deck.forEach(({key, src}, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.key = String(key);
    card.setAttribute("role", "gridcell");
    card.setAttribute("aria-label", "Carta virada");
    card.setAttribute("tabindex", "0");
    card.setAttribute("data-index", String(idx));

    const inner = document.createElement("div");
    inner.className = "card__inner";

    const faceFront = document.createElement("div");
    faceFront.className = "card__face card__face--front";
    const img = createImg(src, key);
    faceFront.appendChild(img);

    const faceBack = document.createElement("div");
    faceBack.className = "card__face card__face--back";

    inner.appendChild(faceFront);
    inner.appendChild(faceBack);
    card.appendChild(inner);

    card.addEventListener("click", () => tryFlip(card));
    card.addEventListener("keydown", (e) => handleCardKey(e, card));

    boardEl.appendChild(card);
  });

  // checker assíncrono (lista 404s no console sem travar)
  (function checkAssetsOnce(deck){
    const missing = [];
    deck.forEach(({src}) => {
      const t = new Image();
      t.onerror = () => missing.push(src);
      t.src = src;
    });
    setTimeout(() => {
      if (missing.length) {
        console.warn("[MEMORY] Arquivos ausentes (verifique caminho/extensão):", missing);
      }
    }, 500);
  })(deck);

  stopTimer();
}

// ============================== JOGO (regras) ==============================
function updateBestHud(){
  const best = getBest(state.diffKey);
  hud.best.textContent = best ? `Recorde: ${fmtTime(best.timeSec)} / ${best.moves} mov.` : "Recorde —";
}
function updateStats(){
  hud.pairs.textContent = `${state.foundPairs}/${state.totalPairs}`;
  hud.moves.textContent = `Movimentos: ${state.moves}`;
}
function showWin(){
  const elapsed = parseTime(hud.time.textContent);
  const improved = setBest(state.diffKey, state.moves, elapsed);
  const text = `Dificuldade: ${CONFIG.DIFFS[state.diffKey].label} • Pares: ${state.totalPairs} • Movimentos: ${state.moves} • Tempo: ${hud.time.textContent}`;
  $("#win-stats").textContent = text;
  $("#win-best").textContent = improved
    ? "🎉 Novo recorde salvo!"
    : (getBest(state.diffKey) ? `Seu recorde atual: ${fmtTime(getBest(state.diffKey).timeSec)} / ${getBest(state.diffKey).moves} mov.` : "Ainda sem recorde.");
  updateBestHud();
  sfx.win();
  showScreen("win");
}
function tryFlip(card){
  if (state.lock || state.paused) return;
  if (card.classList.contains("flipped")) return;
  if (state.firstCard && state.firstCard === card) return;

  card.classList.add("flipped");
  card.setAttribute("aria-label", `Carta ${card.dataset.key} virada`);
  sfx.flip();

  if (!state.firstCard){
    state.firstCard = card;
    if (!state.timerId) startTimer();
    return;
  }

  state.moves += 1;
  const isMatch = state.firstCard.dataset.key === card.dataset.key;
  updateStats();

  if (isMatch){
    card.style.pointerEvents = "none";
    state.firstCard.style.pointerEvents = "none";
    state.firstCard = null;
    state.foundPairs += 1;
    updateStats();
    sfx.match();

    if (state.foundPairs === state.totalPairs){
      stopTimer();
      setTimeout(showWin, 350);
    }
  } else {
    state.lock = true;
    sfx.nope();
    setTimeout(() => {
      card.classList.remove("flipped");
      card.setAttribute("aria-label", "Carta virada");
      state.firstCard.classList.remove("flipped");
      state.firstCard.setAttribute("aria-label", "Carta virada");
      state.firstCard = null;
      state.lock = false;
    }, CONFIG.FLIP_BACK_MS);
  }
}

// ============================== HINT / PAUSE ==============================
function useHint(){
  if (state.hintUsed || state.paused || !state.diffKey) return;
  state.hintUsed = true;
  btnHint.disabled = true;
  btnHint.textContent = "Dica (0)";
  const toClose = [];
  $$(".card").forEach(c => {
    if (!c.classList.contains("flipped")) {
      c.classList.add("flipped");
      toClose.push(c);
    }
  });
  setTimeout(() => { toClose.forEach(c => c.classList.remove("flipped")); }, CONFIG.HINT_DURATION_MS);
}
function togglePause(){
  if (!state.diffKey) return;

  if (!state.paused){
    pauseTimer();
    state.paused = true;

    // BLOQUEIA cliques do tabuleiro enquanto pausado
    boardEl.style.pointerEvents = "none";

    pauseOverlay.hidden = false;
    btnPause.setAttribute("aria-pressed", "true");
    btnPause.textContent = "Retomar";
  } else {
    pauseOverlay.hidden = true;
    btnPause.setAttribute("aria-pressed", "false");
    btnPause.textContent = "Pausar";

    // LIBERA cliques do tabuleiro
    boardEl.style.pointerEvents = "auto";

    state.paused = false;
    resumeTimer();
  }
}

// ============================== A11Y: TECLADO ==============================
function handleCardKey(e, card){
  const cards = $$(".card");
  const idx = parseInt(card.dataset.index, 10) || 0;
  const cols = getComputedStyle(boardEl).gridTemplateColumns.split(" ").length;

  switch(e.key){
    case "Enter":
    case " ":
      e.preventDefault();
      tryFlip(card);
      break;
    case "ArrowRight":
      e.preventDefault();
      (cards[idx+1] || cards[0])?.focus();
      break;
    case "ArrowLeft":
      e.preventDefault();
      (cards[idx-1] || cards[cards.length-1])?.focus();
      break;
    case "ArrowDown":
      e.preventDefault();
      (cards[idx+cols] || cards[(idx+cols)%cards.length])?.focus();
      break;
    case "ArrowUp":
      e.preventDefault();
      (cards[idx-cols] || cards[(cards.length + idx - cols)%cards.length])?.focus();
      break;
  }
}

// ============================== NAVIGAÇÃO ==============================
btnStart.addEventListener("click", () => showScreen("select"));
btnBackStart.addEventListener("click", () => showScreen("start"));

$$('#screen-select .difficulty-grid .btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const diff = e.currentTarget.getAttribute('data-diff');

    // Preload apenas da dificuldade escolhida
    showScreen('loading');
    btnSkipLoading.hidden = false;
    let skipped = false;
    const onSkip = () => { skipped = true; showScreen('start'); };
    btnSkipLoading.addEventListener("click", onSkip, { once: true });

    await preloadFor(diff, (done, total) => {
      if (skipped) return;
      const pct = Math.round((done/total)*100);
      loaderBar.style.width = pct + "%";
      loaderText.textContent = pct + "%";
    });

    if (!skipped) {
      renderBoard(diff);
      btnHint.disabled = false;
      btnHint.textContent = "Dica (1)";
      showScreen('game');
      btnSkipLoading.hidden = true;
    }
  });
});

btnExit.addEventListener("click", () => {
  stopTimer();
  showScreen("select");
});
btnRestart.addEventListener("click", () => {
  if (state.diffKey) {
    const wasPaused = state.paused;
    stopTimer();
    renderBoard(state.diffKey);
    if (wasPaused && !pauseOverlay.hidden) {
      pauseOverlay.hidden = true;
      btnPause.setAttribute("aria-pressed", "false");
      btnPause.textContent = "Pausar";
    }
  }
});
btnPlayAgain.addEventListener("click", () => {
  if (state.diffKey) {
    renderBoard(state.diffKey);
    showScreen("game");
  } else {
    showScreen("select");
  }
});
btnGoMenu.addEventListener("click", () => {
  stopTimer();
  showScreen("start");
});

btnPause.addEventListener("click", togglePause);
btnHint.addEventListener("click", useHint);
btnMute.addEventListener("click", () => {
  state.mute = !state.mute;
  btnMute.setAttribute("aria-pressed", String(state.mute));
  btnMute.textContent = state.mute ? "🔇" : "🔊";
});

// ============================== BOOT ==============================
(function boot(){
  // começamos direto na tela start; preload acontece na escolha da dificuldade
  showScreen("start");
})();

// ============================== PAUSAR AO PERDER O FOCO ==============================
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screens.game.classList.contains("screen--active") && !state.paused) {
    togglePause();
  }
});

const btnResume = $("#btn-resume");
if (btnResume) {
  btnResume.addEventListener("click", () => {
    togglePause(); // usa a mesma função que já alterna pausa/retomar
  });
}
