/// <reference lib="webworker" />

// ── TÍPUSOK ──────────────────────────────────────────────────────────────────
interface FallingItem {
  active: boolean;
  x: number;
  y: number;
  speed: number;
  type: 'drop' | 'ice' | 'bad';
  radius: number;
}

// Üzenet típusok a főszál <-> worker között
type MainToWorker =
  | { type: 'init';    canvas: OffscreenCanvas; bitmaps: { glass: ImageBitmap; glow: ImageBitmap; drop: ImageBitmap; ice: ImageBitmap; bad: ImageBitmap }; canvasW: number; canvasH: number }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'glassX';  x: number }
  | { type: 'timeLeft'; value: number };

type WorkerToMain =
  | { type: 'fill';    value: number }
  | { type: 'score';   delta: number }
  | { type: 'won' }
  | { type: 'lost' };

// ── ÁLLAPOT ──────────────────────────────────────────────────────────────────
let ctx!: OffscreenCanvasRenderingContext2D;
let CANVAS_W = 320;
let CANVAS_H = 680;

// Pre-scaled sprite canvas-ok (worker belsejében)
let preDropCanvas!: OffscreenCanvas;
let preIceCanvas!: OffscreenCanvas;
let preBadCanvas!: OffscreenCanvas;
let glassOffscreen!: OffscreenCanvas;
let glassGlowOffscreen!: OffscreenCanvas;
let liquidOffscreen!: OffscreenCanvas;

const SHADOW_PAD   = 20;
const GW_PADDED    = 86;
const GH_PADDED    = 106;
const LIQ_W        = 60;
const LIQ_H        = 80;
const CX_REL       = 37;
const BOTTOM_Y_REL = 72;
const TOP_Y_REL    = 10;
const BOTTOM_HALF_W = 16.5;
const TOP_HALF_W    = 21;
const P1_OFFSET     = (16.5 + 21) / 2 - 1.5;

const FILL_PER_DROP =  7;
const FILL_PER_ICE  =  4;
const FILL_PER_BAD  = -15;
const BASE_FRAME_MS = 1000 / 60;
const GLASS_W = 70;
const GLASS_H = 90;

const itemPool: FallingItem[] = Array.from({ length: 40 }, () => ({
  active: false, x: 0, y: 0, speed: 0, type: 'drop', radius: 0
}));
const freeList: number[] = [];

let glassX       = 0;
let fillPercent  = 0;
let timeLeft     = 30;
let score        = 0;
let spawnTimer   = 0;
let spawnInterval = 28;
let frameCount   = 0;
let running      = false;
let lastTime     = 0;
let animId       = 0;
let lastRenderedFill = -1;
let liquidDirty  = false;

const LIQUID_THRESHOLD = 1;
const LIQUID_REDRAW_THRESHOLD = 1;

// ── SPRITE ELŐKÉSZÍTÉS ───────────────────────────────────────────────────────
function prerenderItems(bitmaps: { drop: ImageBitmap; ice: ImageBitmap; bad: ImageBitmap }): void {
  const rDrop = 18, sDrop = rDrop * 2, hDrop = Math.floor(sDrop * 1.4);
  preDropCanvas = new OffscreenCanvas(sDrop, hDrop);
  (preDropCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D)
    .drawImage(bitmaps.drop, 0, 0, sDrop, hDrop);

  const rIce = 22, sIce = rIce * 2;
  preIceCanvas = new OffscreenCanvas(sIce, sIce);
  (preIceCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D)
    .drawImage(bitmaps.ice, 0, 0, sIce, sIce);

  const rBad = 32, sBad = rBad * 2;
  preBadCanvas = new OffscreenCanvas(sBad, sBad);
  (preBadCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D)
    .drawImage(bitmaps.bad, 0, 0, sBad, sBad);
}

function prerenderGlass(bitmaps: { glass: ImageBitmap; glow: ImageBitmap }): void {
  const W = GW_PADDED + SHADOW_PAD * 2;
  const H = GH_PADDED + SHADOW_PAD * 2;

  glassOffscreen = new OffscreenCanvas(W, H);
  (glassOffscreen.getContext('2d') as OffscreenCanvasRenderingContext2D)
    .drawImage(bitmaps.glass, SHADOW_PAD, SHADOW_PAD, GW_PADDED, GH_PADDED);

  glassGlowOffscreen = new OffscreenCanvas(W, H);
  const gc = glassGlowOffscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;
  gc.shadowColor = '#F37021';
  gc.shadowBlur  = 15;
  gc.drawImage(bitmaps.glow, SHADOW_PAD, SHADOW_PAD, GW_PADDED, GH_PADDED);
  gc.shadowBlur  = 0;
}

function prerenderLiquid(): void {
  if (!liquidOffscreen) {
    liquidOffscreen = new OffscreenCanvas(LIQ_W + 20, LIQ_H + 20);
  }
  const diff = Math.abs(fillPercent - lastRenderedFill);
  if (diff < LIQUID_REDRAW_THRESHOLD && lastRenderedFill >= 0) return;

  const lctx = liquidOffscreen.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D;
  lctx.clearRect(0, 0, LIQ_W + 20, LIQ_H + 20);

  const fillH = (fillPercent / 100) * (BOTTOM_Y_REL - TOP_Y_REL);
  if (fillH > 0) {
    const cx = CX_REL, bottomY = BOTTOM_Y_REL, topY = TOP_Y_REL;
    const P0 = BOTTOM_HALF_W, P2 = TOP_HALF_W, P1 = P1_OFFSET;
    const liquidTop = bottomY - fillH;

    lctx.save();
    lctx.globalAlpha = 0.65;
    lctx.beginPath();
    lctx.moveTo(cx - P2, topY);
    lctx.lineTo(cx + P2, topY);
    lctx.quadraticCurveTo(cx + P1, (topY + bottomY) / 2, cx + P0, bottomY);
    lctx.quadraticCurveTo(cx, bottomY + 8, cx - P0, bottomY);
    lctx.quadraticCurveTo(cx - P1, (topY + bottomY) / 2, cx - P2, topY);
    lctx.closePath();
    lctx.clip();

    const grad = lctx.createLinearGradient(0, liquidTop, 0, bottomY + 8);
    grad.addColorStop(0, 'rgba(240, 100, 10, 1)');
    grad.addColorStop(1, 'rgba(20, 5, 0, 1)');
    lctx.fillStyle = grad;
    lctx.fillRect(cx - P2 - 5, liquidTop - 5, P2 * 2 + 10, fillH + 15);

    lctx.globalAlpha = 0.2;
    const shine = lctx.createLinearGradient(cx - P2, 0, cx + P2, 0);
    shine.addColorStop(0, 'rgba(255,255,255,0.9)');
    shine.addColorStop(0.3, 'rgba(255,255,255,0)');
    lctx.fillStyle = shine;
    lctx.fillRect(cx - P2 - 5, liquidTop - 5, P2 * 2 + 10, fillH + 15);
    lctx.restore();

    const t = fillH / (BOTTOM_Y_REL - TOP_Y_REL);
    const hw = (1-t)*(1-t)*P0 + 2*(1-t)*t*P1 + t*t*P2;
    lctx.globalAlpha = 0.7;
    lctx.fillStyle   = 'rgba(255, 170, 60, 0.7)';
    lctx.beginPath();
    lctx.ellipse(cx, liquidTop, hw, 3, 0, 0, Math.PI * 2);
    lctx.fill();
    lctx.globalAlpha = 1;
  }

  lastRenderedFill = fillPercent;
  liquidDirty = false;
}

// ── GAME LOOP ────────────────────────────────────────────────────────────────
function gameLoop(timestamp: number): void {
  if (!running) return;

  if (!lastTime) lastTime = timestamp;
  const delta     = Math.min(timestamp - lastTime, 50);
  lastTime        = timestamp;
  const timeScale = delta / BASE_FRAME_MS;

  update(timeScale);

  if (liquidDirty) prerenderLiquid();

  render();

  animId = requestAnimationFrame(gameLoop);
}

function update(timeScale: number): void {
  frameCount++;
  spawnTimer += timeScale;

  const elapsed    = 30 - timeLeft;
  const difficulty = 1 + elapsed * 0.08;

  if (spawnTimer >= spawnInterval) {
    spawnTimer    = 0;
    spawnInterval = Math.max(7, 26 - elapsed * 2);
    spawnItem();
  }

  const glassTop    = CANVAS_H - 130;
  const glassBottom = glassTop + GLASS_H;

  let fillDelta  = 0;
  let scoreDelta = 0;

  for (let i = 0; i < itemPool.length; i++) {
    const item = itemPool[i];
    if (!item.active) continue;

    item.y += item.speed * difficulty * timeScale;

    const inX = item.x > glassX && item.x < glassX + GLASS_W;
    const inY = item.y + item.radius > glassTop && item.y - item.radius < glassBottom;

    if (inX && inY) {
      item.active = false;
      freeList.push(i);
      if (item.type === 'drop')     { fillDelta += FILL_PER_DROP; scoreDelta++; }
      else if (item.type === 'ice') { fillDelta += FILL_PER_ICE;  scoreDelta++; }
      else                          { fillDelta += FILL_PER_BAD; }
      continue;
    }
    if (item.y > CANVAS_H + 20) {
      item.active = false;
      freeList.push(i);
    }
  }

  if (fillDelta !== 0 || scoreDelta !== 0) {
    const newFill = Math.max(0, Math.min(100, fillPercent + fillDelta));
    if (newFill !== fillPercent && Math.abs(newFill - lastRenderedFill) >= LIQUID_THRESHOLD) {
      liquidDirty = true;
    }
    fillPercent = newFill;
    score      += scoreDelta;

    // Értesítjük a főszálat — ez nem blokkolja a loop-ot
    self.postMessage({ type: 'fill',  value: fillPercent } satisfies WorkerToMain);
    if (scoreDelta > 0) {
      self.postMessage({ type: 'score', delta: scoreDelta } satisfies WorkerToMain);
    }
    if (fillPercent >= 100) {
      running = false;
      self.postMessage({ type: 'won' } satisfies WorkerToMain);
    }
  }
}

function spawnItem(): void {
  if (freeList.length === 0) return;
  const idx  = freeList.pop()!;
  const item = itemPool[idx];

  const rand      = Math.random();
  const badChance = Math.min(0.65, 0.20 + (30 - timeLeft) * 0.022);

  let type: 'drop' | 'ice' | 'bad';
  if (rand < badChance)                             type = 'bad';
  else if (rand < badChance + (1 - badChance) / 2) type = 'ice';
  else                                              type = 'drop';

  const radius = type === 'bad' ? 32 : type === 'ice' ? 22 : 18;
  item.active = true;
  item.type   = type;
  item.radius = radius;
  item.x      = Math.random() * (CANVAS_W - radius * 2) + radius;
  item.y      = -40;
  item.speed  = 4.5 + Math.random() * 3.5;
}

function render(): void {
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const gx = Math.floor(glassX);
  const gy = Math.floor(CANVAS_H - 130);

  if (liquidOffscreen) ctx.drawImage(liquidOffscreen, gx, gy);

  const glassBitmap = fillPercent >= 80 ? glassGlowOffscreen : glassOffscreen;
  if (glassBitmap) ctx.drawImage(glassBitmap, gx - 8 - SHADOW_PAD, gy - 8 - SHADOW_PAD);

  for (let i = 0; i < itemPool.length; i++) {
    const item = itemPool[i];
    if (!item.active) continue;
    const drawX = Math.floor(item.x - item.radius);
    const drawY = Math.floor(item.y - item.radius);
    if (item.type === 'drop')     ctx.drawImage(preDropCanvas, drawX, drawY);
    else if (item.type === 'ice') ctx.drawImage(preIceCanvas,  drawX, drawY);
    else                          ctx.drawImage(preBadCanvas,  drawX, drawY);
  }
}

// ── ÜZENET KEZELŐ ───────────────────────────────────────────────────────────
self.addEventListener('message', (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      CANVAS_W = msg.canvasW;
      CANVAS_H = msg.canvasH;
      ctx = msg.canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;

      // Sprite-ok előkészítése a worker belsejében — főszál nem érintett
      prerenderItems(msg.bitmaps);
      prerenderGlass({ glass: msg.bitmaps.glass, glow: msg.bitmaps.glow });
      prerenderLiquid();
      break;
    }

    case 'start': {
      fillPercent   = 0;
      timeLeft      = 30;
      score         = 0;
      frameCount    = 0;
      spawnTimer    = 0;
      spawnInterval = 28;
      lastRenderedFill = -1;
      liquidDirty   = true;
      lastTime      = 0;
      glassX        = CANVAS_W / 2 - GLASS_W / 2;

      freeList.length = 0;
      for (let i = 0; i < itemPool.length; i++) {
        itemPool[i].active = false;
        freeList.push(i);
      }

      running = true;
      animId  = requestAnimationFrame(gameLoop);
      break;
    }

    case 'stop': {
      running = false;
      cancelAnimationFrame(animId);
      break;
    }

    case 'glassX': {
      // Pohár pozíció frissítése főszálról — közvetlen write, nincs szinkronizáció overhead
      glassX = Math.max(0, Math.min(CANVAS_W - GLASS_W, msg.x));
      break;
    }

    case 'timeLeft': {
      timeLeft = msg.value;
      if (timeLeft <= 0) {
        running = false;
        cancelAnimationFrame(animId);
        self.postMessage({ type: 'lost' } satisfies WorkerToMain);
      }
      break;
    }
  }
});