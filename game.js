// ==================== CONFIG ====================
const CONFIG = {
  ASSET_BASE: "assets",
  EXT: "png",
  DIFFS: {
    easy:   { label: "Fácil",   pairs: 4,  boardClass: "board--easy" },
    medium: { label: "Médio",   pairs: 8,  boardClass: "board--medium" },
    hard:   { label: "Difícil", pairs: 12, boardClass: "board--hard" },
  },
  TIME_LIMITS: { easy: 30, medium: 45, hard: 60 },
  FLIP_BACK_MS: 600
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ==================== ELEMENTOS ====================
const screens = {
  start: $("#screen-start"),
  select: $("#screen-select"),
  game: $("#screen-game"),
  win: $("#screen-win"),
};
const board = $("#board");
const hud = {
  diff: $("#hud-difficulty"),
  time: $("#hud-time"),
};
const overlay = $("#pause-overlay");
const btnStart = $("#btn-start");
const btnBack = $("#btn-back-start");
const btnExit = $("#btn-exit");
const btnResume = $("#btn-resume");
const btnPlayAgain = $("#btn-play-again");
const btnGoMenu = $("#btn-go-menu");

// ==================== STATE ====================
let state = {
  diff: null,
  pairs: 0,
  found: 0,
  first: null,
  lock: false,
  timeLeft: 0,
  totalTime: 0,
  timerId: null,
};

// ==================== UTIL ====================
function showScreen(name){
  $$(".screen").forEach(s => s.classList.remove("screen--active"));
  screens[name].classList.add("screen--active");
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function fmt(sec){
  const s=Math.max(0,sec|0);
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

// ==================== TIMEBAR ====================
function updateTimebar(pct){
  const bar=$("#timebar");
  const fill=bar.querySelector(".timebar__fill");
  fill.style.width=(pct*100).toFixed(0)+"%";
  bar.classList.remove("is-warn","is-danger");
  if(pct<=0.5) bar.classList.add("is-warn");
  if(pct<=0.2) bar.classList.add("is-danger");
}

// ==================== TIMER ====================
function startTimer(){
  const now=Date.now();
  state.end=now+state.timeLeft*1000;
  state.timerId=setInterval(()=>{
    const left=Math.ceil((state.end-Date.now())/1000);
    state.timeLeft=Math.max(0,left);
    hud.time.textContent=fmt(state.timeLeft);
    updateTimebar(state.timeLeft/state.totalTime);
    if(state.timeLeft<=0){ stopTimer(); timeUp(); }
  },250);
}
function stopTimer(){
  clearInterval(state.timerId);
  state.timerId=null;
}
function timeUp(){
  state.lock=true;
  board.style.pointerEvents="none";
  overlay.hidden=false;
}

// ==================== BOARD ====================
function makeDeck(diff){
  const cfg=CONFIG.DIFFS[diff];
  const deck=[];
  for(let i=1;i<=cfg.pairs;i++){
    const src=`${CONFIG.ASSET_BASE}/${diff}/${i}.${CONFIG.EXT}`;
    deck.push({k:i,src});
    deck.push({k:i,src});
  }
  return shuffle(deck);
}

function renderBoard(diff){
  const cfg=CONFIG.DIFFS[diff];
  Object.assign(state,{diff,pairs:cfg.pairs,found:0,first:null,lock:false});
  hud.diff.textContent=cfg.label;
  board.className="board "+cfg.boardClass;
  board.innerHTML="";
  board.style.pointerEvents="auto";

  state.totalTime=CONFIG.TIME_LIMITS[diff];
  state.timeLeft=state.totalTime;
  hud.time.textContent=fmt(state.timeLeft);
  updateTimebar(1);

  const deck=makeDeck(diff);
  deck.forEach(({k,src})=>{
    const c=document.createElement("div");
    c.className="card"; c.dataset.k=k;
    const inner=document.createElement("div");
    inner.className="card__inner";
    const f1=document.createElement("div");
    f1.className="card__face card__face--front";
    const img=document.createElement("img");
    img.src=src; f1.appendChild(img);
    const f2=document.createElement("div");
    f2.className="card__face card__face--back";
    inner.append(f1,f2);
    c.appendChild(inner);
    c.onclick=()=>flip(c);
    board.appendChild(c);
  });
}

function flip(card){
  if(state.lock||card.classList.contains("flipped"))return;
  card.classList.add("flipped");
  if(!state.first){
    state.first=card;
    if(!state.timerId) startTimer();
    return;
  }
  const match=state.first.dataset.k===card.dataset.k;
  if(match){
    state.first=null; state.found++;
    if(state.found===state.pairs){ stopTimer(); win(); }
  }else{
    state.lock=true;
    setTimeout(()=>{
      card.classList.remove("flipped");
      state.first.classList.remove("flipped");
      state.first=null; state.lock=false;
    },CONFIG.FLIP_BACK_MS);
  }
}

function win(){
  // Mostra tela de vitória minimal
  showScreen("win");
  // Dispara confete em peso 🎊
  startConfetti();
}
// ==================== NAV ====================
btnStart.onclick=()=>showScreen("select");
btnBack.onclick=()=>showScreen("start");
$$('#screen-select .btn[data-diff]').forEach(b=>b.onclick=()=>{
  renderBoard(b.dataset.diff);
  showScreen("game");
});
btnExit.onclick=()=>{ stopTimer(); showScreen("select"); };
btnResume.onclick=()=>{ overlay.hidden=true; renderBoard(state.diff); showScreen("game"); };
btnPlayAgain.onclick=()=>{ renderBoard(state.diff); showScreen("game"); };
btnGoMenu.onclick=()=>{ stopTimer(); showScreen("start"); };

btnPlayAgain.onclick = () => {
  stopConfetti();
  renderBoard(state.diff);
  showScreen("game");
};

btnGoMenu.onclick = () => {
  stopConfetti();
  stopTimer();
  showScreen("start");
};

showScreen("start");

// ==================== CONFETTI ====================
let confettiRAF = null;
let confettiParticles = [];
let confettiStartedAt = 0;
const CONFETTI_COLORS = ["#ffffff", "#ff6b6b", "#ffd93d", "#6bcBef", "#2bd96b", "#ff8bff", "#00953b"];
const CONFETTI_DURATION_MS = 7000; // quanto tempo anima
const CONFETTI_GRAVITY = 0.12;
const CONFETTI_DRAG = 0.995;
const CONFETTI_COUNT = 320; // MUITO confete 😁

function getCanvas() {
  return document.getElementById("confetti-canvas");
}
function resizeConfettiCanvas() {
  const c = getCanvas();
  if (!c) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  c.width  = Math.floor(c.clientWidth  * dpr);
  c.height = Math.floor(c.clientHeight * dpr);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
}

function makeParticle(w, h) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 6;
  return {
    x: Math.random() * w,
    y: -20 + Math.random() * 40,       // nasce no topo
    vx: Math.cos(angle) * speed * 0.6, // espalha lateralmente
    vy: Math.sin(angle) * speed * 0.2,
    size: 6 + Math.random() * 8,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.2,
    color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
    alpha: 1,
    shape: Math.random() < 0.5 ? "rect" : "circle",
  };
}

function startConfetti() {
  const c = getCanvas();
  if (!c) return;
  resizeConfettiCanvas();
  const w = c.clientWidth, h = c.clientHeight;

  confettiParticles = Array.from({ length: CONFETTI_COUNT }, () => makeParticle(w, h));
  confettiStartedAt = performance.now();

  cancelAnimationFrame(confettiRAF);
  tickConfetti();
}
function stopConfetti() {
  cancelAnimationFrame(confettiRAF);
  confettiRAF = null;
  const c = getCanvas();
  if (c) {
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  }
}
function tickConfetti(ts) {
  const c = getCanvas();
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.clientWidth, h = c.clientHeight;

  // fim por tempo
  if (ts && ts - confettiStartedAt > CONFETTI_DURATION_MS) {
    stopConfetti();
    return;
  }

  ctx.clearRect(0, 0, c.width, c.height);

  // desenha e atualiza
  for (let p of confettiParticles) {
    // física
    p.vx *= CONFETTI_DRAG;
    p.vy = p.vy * CONFETTI_DRAG + CONFETTI_GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;

    // reaparece no topo se sair
    if (p.y > h + 20) {
      p.y = -20;
      p.x = Math.random() * w;
      p.vy = 1 + Math.random() * 2;
      p.vx = (Math.random() - 0.5) * 6;
    }

    // desenho (com leve oscilação de alpha simulando flip)
    const flicker = 0.5 + 0.5 * Math.cos(p.rot * 3);
    const a = 0.6 + 0.4 * flicker;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    if (p.shape === "rect") {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  confettiRAF = requestAnimationFrame(tickConfetti);
}

window.addEventListener("resize", () => {
  const c = getCanvas();
  if (!c || c.closest(".screen")?.id !== "screen-win" || !c.closest(".screen")?.classList.contains("screen--active")) return;
  resizeConfettiCanvas();
});
