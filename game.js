// Jogo da Memória — totalmente local (HTML/CSS/JS)
// Configuração de ativos por dificuldade (coloque as imagens conforme instruções)
const CONFIG = {
  ASSET_BASE: "assets",
  EXT: "png", // troque para "jpg" se preferir
  DIFFS: {
    easy:   { label: "Fácil",  pairs: 5,  cols: 5, rows: 2, boardClass: "board--easy"   },
    medium: { label: "Médio",  pairs: 10, cols: 5, rows: 4, boardClass: "board--medium" },
    hard:   { label: "Difícil",pairs: 20, cols: 8, rows: 5, boardClass: "board--hard"   },
  }
};

// Utilidades
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const screens = {
  start:  $("#screen-start"),
  select: $("#screen-select"),
  game:   $("#screen-game"),
  win:    $("#screen-win")
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
};

let state = {
  diffKey: null,
  totalPairs: 0,
  foundPairs: 0,
  firstCard: null,
  lock: false,
  moves: 0,
  timerId: null,
  startTs: 0,
};

// Timer simples (mm:ss)
function startTimer(){
  state.startTs = Date.now();
  state.timerId = setInterval(() => {
    const s = Math.floor((Date.now() - state.startTs)/1000);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    hud.time.textContent = `${mm}:${ss}`;
  }, 250);
}
function stopTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// Embaralhar Fisher–Yates
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Cria baralho de acordo com a dificuldade
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

// Renderiza tabuleiro
function renderBoard(diffKey){
  const cfg = CONFIG.DIFFS[diffKey];
  state.diffKey = diffKey;
  state.totalPairs = cfg.pairs;
  state.foundPairs = 0;
  state.moves = 0;
  state.firstCard = null;
  state.lock = false;
  hud.difficulty.textContent = cfg.label;
  hud.pairs.textContent = `0/${cfg.pairs}`;
  hud.moves.textContent = `Movimentos: 0`;
  hud.time.textContent = `00:00`;

  // limpar
  boardEl.className = "board " + cfg.boardClass;
  boardEl.innerHTML = "";

  const deck = buildDeck(diffKey);
  deck.forEach(({key, src}) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.key = String(key);

    const inner = document.createElement("div");
    inner.className = "card__inner";

    const faceFront = document.createElement("div");
    faceFront.className = "card__face card__face--front";
    const img = document.createElement("img");
    img.alt = `Carta ${key}`;
    img.src = src;
    faceFront.appendChild(img);

    const faceBack = document.createElement("div");
    faceBack.className = "card__face card__face--back";

    inner.appendChild(faceFront);
    inner.appendChild(faceBack);
    card.appendChild(inner);

    // clique
    card.addEventListener("click", () => onFlip(card));
    boardEl.appendChild(card);
  });
}

function onFlip(card){
  if (state.lock) return;
  if (card.classList.contains("flipped")) return;
  const inner = card.firstElementChild;
  card.classList.add("flipped");

  if (!state.firstCard){
    state.firstCard = card;
    if (!state.timerId) startTimer();
    return;
  }

  // Segundo clique
  state.moves += 1;
  hud.moves.textContent = `Movimentos: ${state.moves}`;

  const isMatch = state.firstCard.dataset.key === card.dataset.key;
  if (isMatch){
    // bloqueia novas interações nessas cartas
    card.style.pointerEvents = "none";
    state.firstCard.style.pointerEvents = "none";
    state.firstCard = null;
    state.foundPairs += 1;
    hud.pairs.textContent = `${state.foundPairs}/${state.totalPairs}`;
    if (state.foundPairs === state.totalPairs){
      stopTimer();
      setTimeout(showWin, 400);
    }
  } else {
    state.lock = true;
    setTimeout(() => {
      card.classList.remove("flipped");
      state.firstCard.classList.remove("flipped");
      state.firstCard = null;
      state.lock = false;
    }, 650);
  }
}

function showWin(){
  const elapsed = hud.time.textContent;
  const text = `Dificuldade: ${CONFIG.DIFFS[state.diffKey].label} • Pares: ${state.totalPairs} • Movimentos: ${state.moves} • Tempo: ${elapsed}`;
  document.getElementById("win-stats").textContent = text;
  showScreen("win");
}

// Navegação básica
document.getElementById("btn-start").addEventListener("click", () => showScreen("select"));
document.getElementById("btn-back-start").addEventListener("click", () => showScreen("start"));

$$('#screen-select .difficulty-grid .btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const diff = e.currentTarget.getAttribute('data-diff');
    renderBoard(diff);
    showScreen('game');
  });
});

document.getElementById("btn-exit").addEventListener("click", () => {
  stopTimer();
  showScreen("select");
});

document.getElementById("btn-restart").addEventListener("click", () => {
  if (state.diffKey) {
    stopTimer();
    renderBoard(state.diffKey);
  }
});

document.getElementById("btn-play-again").addEventListener("click", () => {
  if (state.diffKey) {
    renderBoard(state.diffKey);
    showScreen("game");
  } else {
    showScreen("select");
  }
});

document.getElementById("btn-go-menu").addEventListener("click", () => {
  stopTimer();
  showScreen("start");
});

// Inicia na tela inicial
showScreen("start");
