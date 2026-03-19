import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Output, EventEmitter, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface FallingItem {
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
})
export class CatchTheJagerComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() gameWon  = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private zone = inject(NgZone);

  state: GameState = 'idle';
  fillPercent = 0;
  timeLeft    = 30;
  score       = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any         = null;

  private glassX          = 0;
  private readonly glassW = 70;
  private readonly glassH = 90;
  private isDragging       = false;
  private dragOffsetX      = 0;

  // ── FIX 4: getBoundingClientRect cache ──────────────────────────────────
  // getBoundingClientRect() layout thrashing-t okoz (kényszeríti a böngészőt
  // a layout újraszámítására). Touch/mouse move esetén 60x/s hívva = katasztrófa.
  // Egyszer számoljuk ki, és resize-kor frissítjük.
  private cachedRect!: DOMRect;
  private readonly boundResizeObserver = new ResizeObserver(() => {
    if (this.canvas) this.cachedRect = this.canvas.getBoundingClientRect();
  });

  private items:         FallingItem[] = [];
  private spawnTimer     = 0;
  private spawnInterval  = 40;
  private frameCount     = 0;

  private readonly CANVAS_W      = 390;
  private readonly CANVAS_H      = 680;
  private readonly FILL_PER_DROP =  7;
  private readonly FILL_PER_ICE  =  4;
  private readonly FILL_PER_BAD  = -15;

  // ── ImageBitmap cache ────────────────────────────────────────────────────
  private bitmapGlass:  ImageBitmap | null = null;
  private bitmapIce:    ImageBitmap | null = null;
  private bitmapBroken: ImageBitmap | null = null;
  private bitmapDrop:   ImageBitmap | null = null;

  private readonly imgGlass  = new Image();
  private readonly imgIce    = new Image();
  private readonly imgBroken = new Image();
  private readonly imgDrop   = new Image();

  // ── FIX 2: Bound listener referenciák ───────────────────────────────────
  // bind(this) minden híváskor új referenciát ad → removeEventListener nem működik
  // → minden startGame()-nél halmozódnak a listenerek
  private readonly boundTouchStart = this.onTouchStart.bind(this);
  private readonly boundTouchMove  = this.onTouchMove.bind(this);
  private readonly boundTouchEnd   = this.onTouchEnd.bind(this);
  private readonly boundMouseDown  = this.onMouseDown.bind(this);
  private readonly boundMouseMove  = this.onMouseMove.bind(this);
  private readonly boundMouseUp    = this.onMouseUp.bind(this);

  // ── FIX 5: gameLoop közvetlen referencia ─────────────────────────────────
  // requestAnimationFrame(() => this.gameLoop()) minden frame-ben allokál
  // egy új closure objektumot a heap-en → GC nyomás
  private readonly boundGameLoop = this.gameLoop.bind(this);

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

    Promise.all([
      toBitmap(this.imgGlass),
      toBitmap(this.imgIce),
      toBitmap(this.imgBroken),
      toBitmap(this.imgDrop),
    ]).then(([g, ic, b, d]) => {
      this.bitmapGlass  = g;
      this.bitmapIce    = ic;
      this.bitmapBroken = b;
      this.bitmapDrop   = d;
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

  startGame(): void {
    this.state         = 'playing';
    this.fillPercent   = 0;
    this.timeLeft      = 30;
    this.score         = 0;
    this.items         = [];
    this.frameCount    = 0;
    this.spawnTimer    = 0;
    this.spawnInterval = 40;

    setTimeout(() => {
      this.canvas = this.canvasRef.nativeElement;
      // alpha: false → nincs felesleges compositing
      this.ctx = this.canvas.getContext('2d', { alpha: false })!;
      this.canvas.width  = this.CANVAS_W;
      this.canvas.height = this.CANVAS_H;
      this.glassX = this.CANVAS_W / 2 - this.glassW / 2;

      // Rect cache inicializálása + figyelése
      this.cachedRect = this.canvas.getBoundingClientRect();
      this.boundResizeObserver.observe(this.canvas);

      this.setupInputs();
      this.startTimer();

      this.zone.runOutsideAngular(() => {
        // FIX 5: közvetlen referencia, nem wrapper arrow function
        this.animFrameId = requestAnimationFrame(this.boundGameLoop);
      });
    }, 50);
  }

  // ── GAME LOOP ────────────────────────────────────────────────────────────
  private gameLoop(): void {
    if (this.state !== 'playing') return;
    this.update();
    this.render();
    this.animFrameId = requestAnimationFrame(this.boundGameLoop);
  }

  // ── TIMER ────────────────────────────────────────────────────────────────
  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endGame(false);
        }
      });
    }, 1000);
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  private update(): void {
    this.frameCount++;
    this.spawnTimer++;

    const elapsed    = 30 - this.timeLeft;
    const difficulty = 1 + elapsed * 0.05;

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer    = 0;
      this.spawnInterval = Math.max(12, 35 - elapsed * 2);
      this.spawnItem();
    }

    const glassTop    = this.CANVAS_H - 130;
    const glassBottom = glassTop + this.glassH;

    // ── FIX 3: Batch zone.run ─────────────────────────────────────────────
    // Az eredeti kód minden elkapott elemnél külön zone.run()-t hívott,
    // ami minden egyes alkalommal Angular change detection-t triggerelt.
    // Most összegyűjtjük a változásokat, és egyszer közöljük.
    let fillDelta  = 0;
    let scoreDelta = 0;

    // ── FIX 1+: Swap-and-pop törlés ──────────────────────────────────────
    // splice() O(n): minden törlésnél újraindexeli az egész tömböt.
    // swap-and-pop O(1): utolsó elem a törölt helyére, aztán pop().
    // A sorrend nem számít a játékban, tehát ez biztonságos.
    let i = this.items.length - 1;
    while (i >= 0) {
      const item = this.items[i];
      item.y += item.speed * difficulty;

      const inX = item.x > this.glassX && item.x < this.glassX + this.glassW;
      const inY = item.y + item.radius > glassTop && item.y - item.radius < glassBottom;

      if (inX && inY) {
        // swap-and-pop
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();

        if (item.type === 'drop')     { fillDelta += this.FILL_PER_DROP; scoreDelta++; }
        else if (item.type === 'ice') { fillDelta += this.FILL_PER_ICE;  scoreDelta++; }
        else                          { fillDelta += this.FILL_PER_BAD; }

        i--;
        continue;
      }

      if (item.y > this.CANVAS_H + 20) {
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
        i--;
        continue;
      }

      i--;
    }

    if (fillDelta !== 0 || scoreDelta !== 0) {
      this.zone.run(() => {
        this.fillPercent = Math.max(0, Math.min(100, this.fillPercent + fillDelta));
        this.score      += scoreDelta;
        if (this.fillPercent >= 100) {
          this.endGame(true);
        }
      });
    }
  }

  // ── SPAWN ────────────────────────────────────────────────────────────────
  private spawnItem(): void {
    const rand      = Math.random();
    const badChance = Math.min(0.50, 0.25 + (30 - this.timeLeft) * 0.015);

    let type: 'drop' | 'ice' | 'bad';
    if (rand < badChance)                             type = 'bad';
    else if (rand < badChance + (1 - badChance) / 2) type = 'ice';
    else                                              type = 'drop';

    const radius = type === 'bad' ? 32 : type === 'ice' ? 22 : 18;

    this.items.push({
      x:      Math.random() * (this.CANVAS_W - radius * 2) + radius,
      y:      -40,
      speed:  3.0 + Math.random() * 3.0,
      type,
      radius,
    });
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  private render(): void {
    const ctx = this.ctx;
    const W   = this.CANVAS_W;
    const H   = this.CANVAS_H;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    const gx = Math.floor(this.glassX);
    const gy = Math.floor(H - 130);
    const gw = Math.floor(this.glassW);
    const gh = Math.floor(this.glassH);

    // ── 1. Folyadék (visszaállítva, ez az eredeti logika) ─────────────────
    const cx          = gx + gw / 2 + 2;
    const bottomY     = gy + gh - 18;
    const topY        = gy + 10;
    const bottomHalfW = 16.5;
    const topHalfW    = 21;
    const P0          = bottomHalfW;
    const P2          = topHalfW;
    const P1          = (P0 + P2) / 2 - 1.5;

    const maxFillHeight = bottomY - topY;
    const fillH         = (this.fillPercent / 100) * maxFillHeight;

    if (fillH > 0) {
      const liquidTop = bottomY - fillH;

      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW, topY);
      ctx.lineTo(cx + topHalfW, topY);
      ctx.quadraticCurveTo(cx + P1, (topY + bottomY) / 2, cx + bottomHalfW, bottomY);
      ctx.quadraticCurveTo(cx, bottomY + 8, cx - bottomHalfW, bottomY);
      ctx.quadraticCurveTo(cx - P1, (topY + bottomY) / 2, cx - topHalfW, topY);
      ctx.closePath();
      ctx.clip();

      const grad = ctx.createLinearGradient(0, liquidTop, 0, bottomY + 8);
      grad.addColorStop(0, 'rgba(240, 100, 10, 1)');
      grad.addColorStop(1, 'rgba(20, 5, 0, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - topHalfW - 5, liquidTop - 5, topHalfW * 2 + 10, fillH + 15);

      ctx.globalAlpha = 0.2;
      const shineGrad = ctx.createLinearGradient(cx - topHalfW, 0, cx + topHalfW, 0);
      shineGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
      shineGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
      ctx.fillStyle = shineGrad;
      ctx.fillRect(cx - topHalfW - 5, liquidTop - 5, topHalfW * 2 + 10, fillH + 15);

      ctx.restore();

      // Felső ellipszis (folyadék teteje)
      const t            = fillH / maxFillHeight;
      const currentHalfW = (1 - t) * (1 - t) * P0 + 2 * (1 - t) * t * P1 + t * t * P2;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle   = 'rgba(255, 170, 60, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, liquidTop, currentHalfW, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── 2. Pohár – FIX: csak EGYSZER rajzolva ────────────────────────────
    // Az eredeti kód kétszer rajzolta: egyszer shadowBlur=0-val,
    // egyszer save/restore-ral. Az első drawImage teljesen felesleges volt.
    ctx.shadowBlur = 0;
    if (this.fillPercent >= 80) {
      ctx.shadowColor = '#F37021';
      ctx.shadowBlur  = 15;
    }
    const glassSrc = this.bitmapGlass ?? this.imgGlass;
    ctx.drawImage(glassSrc, gx - 8, gy - 8, gw + 16, gh + 16);
    ctx.shadowBlur = 0; // reset árnyék a következő elemek előtt

    // ── 3. Eső elemek – ImageBitmap, nincs save/restore ──────────────────
    for (let i = 0; i < this.items.length; i++) {
      const item  = this.items[i];
      const s     = Math.floor(item.radius * 2);
      const drawX = Math.floor(item.x - item.radius);
      const drawY = Math.floor(item.y - item.radius);

      if (item.type === 'drop') {
        ctx.drawImage(this.bitmapDrop   ?? this.imgDrop,   drawX, drawY, s, Math.floor(s * 1.4));
      } else if (item.type === 'ice') {
        ctx.drawImage(this.bitmapIce    ?? this.imgIce,    drawX, drawY, s, s);
      } else {
        ctx.drawImage(this.bitmapBroken ?? this.imgBroken, drawX, drawY, s, s);
      }
    }
  }

  // ── JÁTÉK VÉGE ───────────────────────────────────────────────────────────
  private endGame(won: boolean): void {
    this.stopGame();
    this.zone.run(() => {
      this.state = won ? 'won' : 'lost';
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

  // ── INPUT ────────────────────────────────────────────────────────────────
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

  // ── FIX 4: cachedRect használata getBoundingClientRect() helyett ─────────
  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch  = e.touches[0];
    const rect   = this.cachedRect;
    const scaleX = this.CANVAS_W / rect.width;
    const tx     = (touch.clientX - rect.left) * scaleX;
    if (tx > this.glassX - 20 && tx < this.glassX + this.glassW + 20) {
      this.isDragging  = true;
      this.dragOffsetX = tx - this.glassX;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    const touch  = e.touches[0];
    const rect   = this.cachedRect;
    const scaleX = this.CANVAS_W / rect.width;
    const tx     = (touch.clientX - rect.left) * scaleX;
    this.glassX  = Math.max(0, Math.min(this.CANVAS_W - this.glassW, tx - this.dragOffsetX));
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  private onMouseDown(e: MouseEvent): void {
    const rect   = this.cachedRect;
    const scaleX = this.CANVAS_W / rect.width;
    const mx     = (e.clientX - rect.left) * scaleX;
    if (mx > this.glassX - 20 && mx < this.glassX + this.glassW + 20) {
      this.isDragging  = true;
      this.dragOffsetX = mx - this.glassX;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const rect   = this.cachedRect;
    const scaleX = this.CANVAS_W / rect.width;
    const mx     = (e.clientX - rect.left) * scaleX;
    this.glassX  = Math.max(0, Math.min(this.CANVAS_W - this.glassW, mx - this.dragOffsetX));
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  retry(): void {
    this.state = 'idle';
  }
}