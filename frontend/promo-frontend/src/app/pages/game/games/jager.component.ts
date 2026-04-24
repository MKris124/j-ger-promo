import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Output, EventEmitter, NgZone,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface FallingItem {
  active: boolean;
  x: number;
  y: number;
  speed: number;
  type: 'drop' | 'ice' | 'bad';
  radius: number;
}

type GameState = 'idle' | 'playing' | 'won' | 'lost';

@Component({
  selector: 'app-catch-jager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catch-the-jager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatchTheJagerComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() gameWon  = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private zone = inject(NgZone);
  private cdr  = inject(ChangeDetectorRef);

  state: GameState = 'idle';
  fillPercent  = 0;
  timeLeft     = 30;
  score        = 0;
  assetsReady  = false; // A "Start" gomb csak akkor aktív, ha ez true
  canvasScale  = 1;     // CSS transform scale — a wrapper div alkalmazza

  // A játék csak ezt a Promise-t várja meg — soha nem indul nyers képekkel
  private assetsReadyPromise!: Promise<void>;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any         = null;
  private lastTime: number = 0;

  // ── KÉTLAYERES CANVAS ─────────────────────────────────────────────────────
  // A statikus hátteret egyszer rajzoljuk, a játék-canvas fölé rétegezzük.
  private bgCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private bgRendered = false;

  private glassX          = 0;
  private readonly glassW = 70;
  private readonly glassH = 90;
  private isDragging       = false;
  private dragOffsetX      = 0;

  private cachedRect!: DOMRect;
  private cachedScaleX = 1;
  private readonly boundResizeObserver = new ResizeObserver(() => this.updateRect());

  // ── OBJECT POOL ───────────────────────────────────────────────────────────
  private itemPool: FallingItem[] = Array.from({ length: 40 }, () => ({
    active: false, x: 0, y: 0, speed: 0, type: 'drop', radius: 0
  }));

  // O(1) szabad-index stack (pool indexeket tárolja)
  private freeList: number[] = Array.from({ length: 40 }, (_, i) => i);

  private spawnTimer     = 0;
  private spawnInterval  = 40;
  private frameCount     = 0;

  // ── FPS: rAF natívan fut a kijelző Hz-én, nincs throttle ────────────────
  // A deltaTime-ot normalizáljuk 60fps-re, így a játéksebesség
  // független a refresh rate-től (60/90/120Hz mind ugyanolyan gyors)
  private readonly BASE_FRAME_MS = 1000 / 60; // 16.666ms referencia

  private readonly CANVAS_W      = 390;
  private readonly CANVAS_H      = 680;
  private readonly FILL_PER_DROP =  7;
  private readonly FILL_PER_ICE  =  4;
  private readonly FILL_PER_BAD  = -15;

  private bitmapGlass:  ImageBitmap | null = null;
  private bitmapIce:    ImageBitmap | null = null;
  private bitmapBroken: ImageBitmap | null = null;
  private bitmapDrop:   ImageBitmap | null = null;

  private readonly imgGlass  = new Image();
  private readonly imgIce    = new Image();
  private readonly imgBroken = new Image();
  private readonly imgDrop   = new Image();

  private readonly GW_PADDED  = 86;
  private readonly GH_PADDED  = 106;
  private readonly SHADOW_PAD = 20;

  private glassOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private glassOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private glassGlowOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private glassGlowOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  private liquidOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private liquidOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private readonly LIQ_W = 60;
  private readonly LIQ_H = 80;

  private preDropCanvas!: OffscreenCanvas | HTMLCanvasElement;
  private preIceCanvas!: OffscreenCanvas | HTMLCanvasElement;
  private preBadCanvas!: OffscreenCanvas | HTMLCanvasElement;

  // ── LIQUID THROTTLE ───────────────────────────────────────────────────────
  // Csak akkor rajzoljuk újra, ha legalább 1%-ot változott a töltöttség.
  private lastRenderedFill  = -1;
  private liquidDirty       = false;
  private readonly LIQUID_REDRAW_THRESHOLD = 1;

  private readonly CX_REL        = 35 + 2;
  private readonly BOTTOM_Y_REL  = 72;
  private readonly TOP_Y_REL     = 10;
  private readonly BOTTOM_HALF_W = 16.5;
  private readonly TOP_HALF_W    = 21;
  private readonly P1_OFFSET     = (16.5 + 21) / 2 - 1.5;

  private readonly boundTouchStart = this.onTouchStart.bind(this);
  private readonly boundTouchMove  = this.onTouchMove.bind(this);
  private readonly boundTouchEnd   = this.onTouchEnd.bind(this);
  private readonly boundMouseDown  = this.onMouseDown.bind(this);
  private readonly boundMouseMove  = this.onMouseMove.bind(this);
  private readonly boundMouseUp    = this.onMouseUp.bind(this);
  private readonly boundGameLoop   = this.gameLoop.bind(this);

  // ── PIXEL RATIO ───────────────────────────────────────────────────────────
  // Gyenge eszközökön a DPR-t 1-re szorítjuk, hogy ne kelljen 2× pixelt rajzolni.
  private readonly dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  ngOnInit(): void {
    this.imgGlass.src  = 'assets/glass.png';
    this.imgIce.src    = 'assets/ice.png';
    this.imgBroken.src = 'assets/broken.png';
    this.imgDrop.src   = 'assets/drop.png';

    const toBitmap = (img: HTMLImageElement): Promise<ImageBitmap> =>
      new Promise(resolve => {
        const make = () => createImageBitmap(img).then(resolve);
        if (img.complete && img.naturalWidth > 0) make();
        else img.onload = make;
      });

    // assetsReadyPromise: startGame() ezt várja meg — soha nem indul nyers képekkel
    this.assetsReadyPromise = Promise.all([
      toBitmap(this.imgGlass),
      toBitmap(this.imgIce),
      toBitmap(this.imgBroken),
      toBitmap(this.imgDrop),
    ]).then(([g, ic, b, d]) => {
      this.bitmapGlass  = g;
      this.bitmapIce    = ic;
      this.bitmapBroken = b;
      this.bitmapDrop   = d;
      this.prerenderGlass();
      this.prerenderItems();
    }).catch(() => {
      // Fallback nyers képekkel, ha createImageBitmap nem elérhető
      this.prerenderGlass();
      this.prerenderItems();
    }).then(() => {
      // Minden prerender kész -> Start gomb engedélyezése
      this.zone.run(() => {
        this.assetsReady = true;
        this.cdr.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    this.stopGame();
    this.boundResizeObserver.disconnect();
    this.bitmapGlass?.close();
    this.bitmapIce?.close();
    this.bitmapBroken?.close();
    this.bitmapDrop?.close();
  }

  private createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const c = document.createElement('canvas');
    c.width  = width;
    c.height = height;
    return c;
  }

  private prerenderItems(): void {
    const srcDrop = this.bitmapDrop  ?? this.imgDrop;
    const srcIce  = this.bitmapIce   ?? this.imgIce;
    const srcBad  = this.bitmapBroken ?? this.imgBroken;

    const rDrop = 18, sDrop = rDrop * 2, hDrop = Math.floor(sDrop * 1.4);
    this.preDropCanvas = this.createOffscreenCanvas(sDrop, hDrop);
    (this.preDropCanvas.getContext('2d') as CanvasRenderingContext2D)
      .drawImage(srcDrop, 0, 0, sDrop, hDrop);

    const rIce = 22, sIce = rIce * 2;
    this.preIceCanvas = this.createOffscreenCanvas(sIce, sIce);
    (this.preIceCanvas.getContext('2d') as CanvasRenderingContext2D)
      .drawImage(srcIce, 0, 0, sIce, sIce);

    const rBad = 32, sBad = rBad * 2;
    this.preBadCanvas = this.createOffscreenCanvas(sBad, sBad);
    (this.preBadCanvas.getContext('2d') as CanvasRenderingContext2D)
      .drawImage(srcBad, 0, 0, sBad, sBad);
  }

  private prerenderGlass(): void {
    const W = this.GW_PADDED + this.SHADOW_PAD * 2;
    const H = this.GH_PADDED + this.SHADOW_PAD * 2;
    const source = this.bitmapGlass || this.imgGlass;

    this.glassOffscreen = this.createOffscreenCanvas(W, H);
    this.glassOffCtx    = this.glassOffscreen.getContext('2d') as any;
    this.glassOffCtx.drawImage(source, this.SHADOW_PAD, this.SHADOW_PAD, this.GW_PADDED, this.GH_PADDED);

    this.glassGlowOffscreen = this.createOffscreenCanvas(W, H);
    this.glassGlowOffCtx    = this.glassGlowOffscreen.getContext('2d') as any;
    this.glassGlowOffCtx.shadowColor = '#F37021';
    this.glassGlowOffCtx.shadowBlur  = 15;
    this.glassGlowOffCtx.drawImage(source, this.SHADOW_PAD, this.SHADOW_PAD, this.GW_PADDED, this.GH_PADDED);
    this.glassGlowOffCtx.shadowBlur  = 0;
  }

  // ── LIQUID PRERENDER ──────────────────────────────────────────────────────
  // Csak ha dirty flag be van állítva ÉS a változás >= threshold
  private prerenderLiquid(): void {
    if (!this.liquidOffscreen) {
      this.liquidOffscreen = this.createOffscreenCanvas(this.LIQ_W + 20, this.LIQ_H + 20);
      this.liquidOffCtx    = this.liquidOffscreen.getContext('2d', { alpha: true }) as any;
    }

    const diff = Math.abs(this.fillPercent - this.lastRenderedFill);
    if (diff < this.LIQUID_REDRAW_THRESHOLD && this.lastRenderedFill >= 0) {
      this.liquidDirty = false;
      return;
    }

    const ctx = this.liquidOffCtx;
    ctx.clearRect(0, 0, this.LIQ_W + 20, this.LIQ_H + 20);

    const fillH = (this.fillPercent / 100) * (this.BOTTOM_Y_REL - this.TOP_Y_REL);
    if (fillH > 0) {
      const cx = this.CX_REL, bottomY = this.BOTTOM_Y_REL, topY = this.TOP_Y_REL;
      const P0 = this.BOTTOM_HALF_W, P2 = this.TOP_HALF_W, P1 = this.P1_OFFSET;
      const liquidTop = bottomY - fillH;

      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(cx - P2, topY);
      ctx.lineTo(cx + P2, topY);
      ctx.quadraticCurveTo(cx + P1, (topY + bottomY) / 2, cx + P0, bottomY);
      ctx.quadraticCurveTo(cx, bottomY + 8, cx - P0, bottomY);
      ctx.quadraticCurveTo(cx - P1, (topY + bottomY) / 2, cx - P2, topY);
      ctx.closePath();
      ctx.clip();

      const grad = ctx.createLinearGradient(0, liquidTop, 0, bottomY + 8);
      grad.addColorStop(0, 'rgba(240, 100, 10, 1)');
      grad.addColorStop(1, 'rgba(20, 5, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - P2 - 5, liquidTop - 5, P2 * 2 + 10, fillH + 15);

      ctx.globalAlpha = 0.2;
      const shine = ctx.createLinearGradient(cx - P2, 0, cx + P2, 0);
      shine.addColorStop(0, 'rgba(255,255,255,0.9)');
      shine.addColorStop(0.3, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillRect(cx - P2 - 5, liquidTop - 5, P2 * 2 + 10, fillH + 15);
      ctx.restore();

      const t = fillH / (this.BOTTOM_Y_REL - this.TOP_Y_REL);
      const currentHalfW = (1 - t) * (1 - t) * P0 + 2 * (1 - t) * t * P1 + t * t * P2;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle   = 'rgba(255, 170, 60, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, liquidTop, currentHalfW, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    this.lastRenderedFill = this.fillPercent;
    this.liquidDirty      = false;
  }

  // ── STATIKUS HÁTTÉR egyszeri rajzolása ────────────────────────────────────
  private renderBackground(): void {
    if (this.bgRendered) return;
    const ctx = this.bgCtx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, this.CANVAS_W, this.CANVAS_H);
    // Ide kerülhet bármilyen statikus dekoráció (rácsok, gradiens stb.)
    this.bgRendered = true;
  }

  startGame(): void {
    this.state         = 'playing';
    this.fillPercent   = 0;
    this.timeLeft      = 30;
    this.score         = 0;
    this.frameCount    = 0;
    this.spawnTimer    = 0;
    this.spawnInterval = 40;
    this.lastRenderedFill = -1;
    this.liquidDirty   = true;
    this.bgRendered    = false;
    this.lastTime      = 0;

    // Pool reset + freeList újraépítése
    this.freeList = [];
    for (let i = 0; i < this.itemPool.length; i++) {
      this.itemPool[i].active = false;
      this.freeList.push(i);
    }

    // KULCS: Megvárjuk az assetsReadyPromise-t, mielőtt bármi rajzolás elkezdődne.
    // setTimeout helyett Promise-chain: garantáltan minden prerender kész mire a loop elindul.
    this.assetsReadyPromise.then(() => {
      setTimeout(() => {
        this.canvas = this.canvasRef.nativeElement;
        this.ctx    = this.canvas.getContext('2d', { alpha: false })!;
        this.canvas.width  = this.CANVAS_W;
        this.canvas.height = this.CANVAS_H;

        // imageRendering hint — mobilon gyorsabb compositing
        this.canvas.style.imageRendering = 'pixelated';

        // Háttér canvas létrehozása és pozicionálása
        if (!this.bgCanvas) {
          this.bgCanvas        = document.createElement('canvas');
          this.bgCanvas.width  = this.CANVAS_W;
          this.bgCanvas.height = this.CANVAS_H;
          this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false })!;
          this.bgCanvas.style.cssText  = this.canvas.style.cssText;
          this.bgCanvas.style.position = 'absolute';
          this.bgCanvas.style.zIndex   = '-1';
          this.canvas.parentElement?.insertBefore(this.bgCanvas, this.canvas);
        }

        this.glassX = this.CANVAS_W / 2 - this.glassW / 2;
        this.updateRect();
        this.boundResizeObserver.observe(this.canvas);

        this.prerenderLiquid();
        this.renderBackground();
        this.setupInputs();
        this.startTimer();

        this.zone.runOutsideAngular(() => {
          this.animFrameId = requestAnimationFrame(this.boundGameLoop);
        });

        this.cdr.markForCheck();
      }, 50);
    });
  }

  private updateRect(): void {
    // A canvas CSS mérete MINDIG egyenlő a belső felbontással (390px).
    // A szülő div transform:scale()-lel kicsinyít — így a böngészőnek
    // NEM kell frame-enként újraskálázni a canvas tartalmát.
    const parentW = this.canvas.parentElement?.clientWidth ?? this.CANVAS_W;
    this.canvasScale  = Math.min(1, parentW / this.CANVAS_W);

    // A cachedRect és cachedScaleX az input koordináta-transzformhoz kell.
    // Mivel a canvas CSS px-ben 390 wide, de transform:scale visually kisebb,
    // a getBoundingClientRect() a vizuális méretet adja vissza —
    // ezért a scaleX-et a CANVAS_W / rect.width képlettel számoljuk.
    this.cachedRect   = this.canvas.getBoundingClientRect();
    this.cachedScaleX = this.CANVAS_W / this.cachedRect.width;

    this.zone.run(() => this.cdr.markForCheck());
  }

  // ── GAME LOOP ────────────────────────────────────────────────────────────
  // Nincs throttle — minden rAF frame-en rajzolunk.
  // A timeScale a deltaTime-ot normalizálja 60fps-re, így a játéksebesség
  // teljesen független a kijelző Hz-étől.
  private gameLoop(timestamp: number): void {
    if (this.state !== 'playing') return;

    if (!this.lastTime) this.lastTime = timestamp;
    // Alt-tab védelem: max 50ms ugrás egy frame alatt
    const delta     = Math.min(timestamp - this.lastTime, 50);
    this.lastTime   = timestamp;

    // timeScale: 1.0 = 60fps, 0.5 = 120fps, 2.0 = 30fps
    // A fizika és spawn logika ettől függetlenül helyes sebességgel fut
    const timeScale = delta / this.BASE_FRAME_MS;

    this.update(timeScale);

    if (this.liquidDirty) {
      this.prerenderLiquid();
    }

    this.render();

    this.zone.runOutsideAngular(() => {
      this.animFrameId = requestAnimationFrame(this.boundGameLoop);
    });
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.timeLeft--;
        this.cdr.markForCheck();
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endGame(false);
        }
      });
    }, 1000);
  }

  private update(timeScale: number): void {
    this.frameCount++;
    this.spawnTimer += timeScale;

    const elapsed    = 30 - this.timeLeft;
    const difficulty = 1 + elapsed * 0.05;

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer    = 0;
      this.spawnInterval = Math.max(12, 35 - elapsed * 2);
      this.spawnItem();
    }

    const glassTop    = this.CANVAS_H - 130;
    const glassBottom = glassTop + this.glassH;

    let fillDelta  = 0;
    let scoreDelta = 0;

    for (let i = 0; i < this.itemPool.length; i++) {
      const item = this.itemPool[i];
      if (!item.active) continue;

      item.y += item.speed * difficulty * timeScale;

      const inX = item.x > this.glassX && item.x < this.glassX + this.glassW;
      const inY = item.y + item.radius > glassTop && item.y - item.radius < glassBottom;

      if (inX && inY) {
        item.active = false;
        this.freeList.push(i); // O(1) visszarakás a szabad-listára
        if (item.type === 'drop')     { fillDelta += this.FILL_PER_DROP; scoreDelta++; }
        else if (item.type === 'ice') { fillDelta += this.FILL_PER_ICE;  scoreDelta++; }
        else                          { fillDelta += this.FILL_PER_BAD; }
        continue;
      }

      if (item.y > this.CANVAS_H + 20) {
        item.active = false;
        this.freeList.push(i);
      }
    }

    if (fillDelta !== 0 || scoreDelta !== 0) {
      // fillPercent és score frissítése zónán belül (UI)
      const newFill = Math.max(0, Math.min(100, this.fillPercent + fillDelta));
      const changed = newFill !== this.fillPercent;

      this.fillPercent = newFill;
      this.score      += scoreDelta;

      // Liquid dirty flag — csak ha elegendő a változás
      if (changed && Math.abs(this.fillPercent - this.lastRenderedFill) >= this.LIQUID_REDRAW_THRESHOLD) {
        this.liquidDirty = true;
      }

      // Zone.run csak a score/fill UI frissítéshez — NEM triggerel prerenderLiquid-ot
      this.zone.run(() => {
        this.cdr.markForCheck();
        if (this.fillPercent >= 100) this.endGame(true);
      });
    }
  }

  // ── SPAWN: O(1) freeList pop ──────────────────────────────────────────────
  private spawnItem(): void {
    if (this.freeList.length === 0) return; // Pool tele, skip

    const idx  = this.freeList.pop()!;
    const item = this.itemPool[idx];

    const rand      = Math.random();
    const badChance = Math.min(0.50, 0.25 + (30 - this.timeLeft) * 0.015);

    let type: 'drop' | 'ice' | 'bad';
    if (rand < badChance)                              type = 'bad';
    else if (rand < badChance + (1 - badChance) / 2) type = 'ice';
    else                                              type = 'drop';

    const radius = type === 'bad' ? 32 : type === 'ice' ? 22 : 18;

    item.active = true;
    item.type   = type;
    item.radius = radius;
    item.x      = Math.random() * (this.CANVAS_W - radius * 2) + radius;
    item.y      = -40;
    item.speed  = 3.0 + Math.random() * 3.0;
  }

  // ── RENDER: háttér canvas-ból másolunk, nem rajzoljuk újra ────────────────
  private render(): void {
    const ctx = this.ctx;

    // Háttér: egyszerű blit a statikus bgCanvas-ból (sokkal gyorsabb mint fillRect + drawImage)
    ctx.drawImage(this.bgCanvas, 0, 0);

    const gx = Math.floor(this.glassX);
    const gy = Math.floor(this.CANVAS_H - 130);

    if (this.liquidOffscreen) {
      ctx.drawImage(this.liquidOffscreen, gx, gy);
    }

    const glassBitmap = this.fillPercent >= 80
      ? this.glassGlowOffscreen
      : this.glassOffscreen;

    if (glassBitmap) {
      ctx.drawImage(glassBitmap, gx - 8 - this.SHADOW_PAD, gy - 8 - this.SHADOW_PAD);
    }

    for (let i = 0; i < this.itemPool.length; i++) {
      const item = this.itemPool[i];
      if (!item.active) continue;

      const drawX = Math.floor(item.x - item.radius);
      const drawY = Math.floor(item.y - item.radius);

      if (item.type === 'drop') {
        ctx.drawImage(this.preDropCanvas, drawX, drawY);
      } else if (item.type === 'ice') {
        ctx.drawImage(this.preIceCanvas, drawX, drawY);
      } else {
        ctx.drawImage(this.preBadCanvas, drawX, drawY);
      }
    }
  }

  private endGame(won: boolean): void {
    this.stopGame();
    this.zone.run(() => {
      this.state = won ? 'won' : 'lost';
      this.cdr.markForCheck();
      if (won) this.gameWon.emit();
      else     this.gameLost.emit();
    });
  }

  private stopGame(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.removeInputs();
  }

  private setupInputs(): void {
    if (!this.canvas) return;
    this.zone.runOutsideAngular(() => {
      this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
      this.canvas.addEventListener('touchmove',  this.boundTouchMove,  { passive: false });
      this.canvas.addEventListener('touchend',   this.boundTouchEnd);
      this.canvas.addEventListener('mousedown',  this.boundMouseDown);
      this.canvas.addEventListener('mousemove',  this.boundMouseMove);
      this.canvas.addEventListener('mouseup',    this.boundMouseUp);
    });
  }

  private removeInputs(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove',  this.boundTouchMove);
    this.canvas.removeEventListener('touchend',   this.boundTouchEnd);
    this.canvas.removeEventListener('mousedown',  this.boundMouseDown);
    this.canvas.removeEventListener('mousemove',  this.boundMouseMove);
    this.canvas.removeEventListener('mouseup',    this.boundMouseUp);
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const tx    = (touch.clientX - this.cachedRect.left) * this.cachedScaleX;
    if (tx > this.glassX - 20 && tx < this.glassX + this.glassW + 20) {
      this.isDragging  = true;
      this.dragOffsetX = tx - this.glassX;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    const touch = e.touches[0];
    const tx    = (touch.clientX - this.cachedRect.left) * this.cachedScaleX;
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, tx - this.dragOffsetX));
  }

  private onTouchEnd(): void { this.isDragging = false; }

  private onMouseDown(e: MouseEvent): void {
    const mx = (e.clientX - this.cachedRect.left) * this.cachedScaleX;
    if (mx > this.glassX - 20 && mx < this.glassX + this.glassW + 20) {
      this.isDragging  = true;
      this.dragOffsetX = mx - this.glassX;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const mx    = (e.clientX - this.cachedRect.left) * this.cachedScaleX;
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, mx - this.dragOffsetX));
  }

  private onMouseUp(): void { this.isDragging = false; }

  retry(): void { this.state = 'idle'; }
}