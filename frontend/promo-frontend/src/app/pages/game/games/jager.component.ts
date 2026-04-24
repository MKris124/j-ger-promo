import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Output, EventEmitter, NgZone,
  ChangeDetectionStrategy, ChangeDetectorRef
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
  // KULCS OPTIMALIZÁCIÓ 1: OnPush, hogy ne fusson le minden frame-nél a CD
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatchTheJagerComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() gameWon  = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef); // A manuális frissítéshez

  state: GameState = 'idle';
  fillPercent = 0;
  timeLeft    = 30;
  score       = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any         = null;
  
  // KULCS OPTIMALIZÁCIÓ 2: Delta time követéshez
  private lastTime: number = 0;

  private glassX          = 0;
  private readonly glassW = 70;
  private readonly glassH = 90;
  private isDragging       = false;
  private dragOffsetX      = 0;

  private cachedRect!: DOMRect;
  private cachedScaleX = 1;
  private readonly boundResizeObserver = new ResizeObserver(() => this.updateRect());

  private items:         FallingItem[] = [];
  private spawnTimer     = 0;
  private spawnInterval  = 40;
  private frameCount     = 0;

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

  // Használunk fallback-et is, hogy mindenhol működjön
  private glassOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private glassOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private glassGlowOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private glassGlowOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  private readonly LIQ_W = 60;
  private readonly LIQ_H = 80;
  private liquidOffscreen!: OffscreenCanvas | HTMLCanvasElement;
  private liquidOffCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  private lastRenderedFill = -1;

  private readonly CX_REL       = 35 + 2; 
  private readonly BOTTOM_Y_REL = 72;     
  private readonly TOP_Y_REL    = 10;
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
      this.prerenderGlass();
    }).catch(err => {
      // Kisebb böngészőknél vagy hibánál is rendereljük elő
      this.prerenderGlass(); 
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

  // Segédfüggvény a biztonságos OffscreenCanvas létrehozáshoz
  private createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  }

  private prerenderGlass(): void {
    const W = this.GW_PADDED + this.SHADOW_PAD * 2;
    const H = this.GH_PADDED + this.SHADOW_PAD * 2;

    this.glassOffscreen = this.createOffscreenCanvas(W, H);
    this.glassOffCtx    = this.glassOffscreen.getContext('2d') as any;
    
    if (this.bitmapGlass || this.imgGlass.complete) {
      const source = this.bitmapGlass || this.imgGlass;
      this.glassOffCtx.drawImage(source, this.SHADOW_PAD, this.SHADOW_PAD, this.GW_PADDED, this.GH_PADDED);
    }

    this.glassGlowOffscreen = this.createOffscreenCanvas(W, H);
    this.glassGlowOffCtx    = this.glassGlowOffscreen.getContext('2d') as any;
    
    if (this.bitmapGlass || this.imgGlass.complete) {
      const source = this.bitmapGlass || this.imgGlass;
      this.glassGlowOffCtx.shadowColor = '#F37021';
      this.glassGlowOffCtx.shadowBlur  = 15;
      this.glassGlowOffCtx.drawImage(source, this.SHADOW_PAD, this.SHADOW_PAD, this.GW_PADDED, this.GH_PADDED);
      this.glassGlowOffCtx.shadowBlur = 0;
    }
  }

  private prerenderLiquid(): void {
    if (!this.liquidOffscreen) {
      this.liquidOffscreen = this.createOffscreenCanvas(this.LIQ_W + 20, this.LIQ_H + 20);
      this.liquidOffCtx    = this.liquidOffscreen.getContext('2d', { alpha: true }) as any;
    }

    const ctx = this.liquidOffCtx;
    ctx.clearRect(0, 0, this.LIQ_W + 20, this.LIQ_H + 20);

    const fillH = (this.fillPercent / 100) * (this.BOTTOM_Y_REL - this.TOP_Y_REL);
    if (fillH <= 0) return;

    const cx      = this.CX_REL;
    const bottomY = this.BOTTOM_Y_REL;
    const topY    = this.TOP_Y_REL;
    const P0      = this.BOTTOM_HALF_W;
    const P2      = this.TOP_HALF_W;
    const P1      = this.P1_OFFSET;
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

    const t            = fillH / (this.BOTTOM_Y_REL - this.TOP_Y_REL);
    const currentHalfW = (1 - t) * (1 - t) * P0 + 2 * (1 - t) * t * P1 + t * t * P2;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle   = 'rgba(255, 170, 60, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx, liquidTop, currentHalfW, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    this.lastRenderedFill = this.fillPercent;
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
    this.lastRenderedFill = -1;
    this.lastTime      = 0; // Reset timer

    setTimeout(() => {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx    = this.canvas.getContext('2d', { alpha: false })!;
      this.canvas.width  = this.CANVAS_W;
      this.canvas.height = this.CANVAS_H;
      this.glassX = this.CANVAS_W / 2 - this.glassW / 2;

      this.updateRect();
      this.boundResizeObserver.observe(this.canvas);

      this.prerenderLiquid();
      this.setupInputs();
      this.startTimer();

      this.zone.runOutsideAngular(() => {
        this.animFrameId = requestAnimationFrame(this.boundGameLoop);
      });
      
      this.cdr.markForCheck(); // Sablon frissítése, hogy a "playing" nézet bejöjjön
    }, 50);
  }

  private updateRect(): void {
    this.cachedRect   = this.canvas.getBoundingClientRect();
    this.cachedScaleX = this.CANVAS_W / this.cachedRect.width;
  }

  // Delta time bevezetése a Loop-ba
  private gameLoop(timestamp: number): void {
    if (this.state !== 'playing') return;
    
    if (!this.lastTime) this.lastTime = timestamp;
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Kb 60 FPS-hez igazítjuk a sebességet (1 frame kb 16.6ms)
    const timeScale = deltaTime / 16.666;

    this.update(timeScale);
    this.render();
    
    this.animFrameId = requestAnimationFrame(this.boundGameLoop);
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.timeLeft--;
        this.cdr.markForCheck(); // Szólunk az Angularnak
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endGame(false);
        }
      });
    }, 1000);
  }

  private update(timeScale: number): void {
    this.frameCount++;
    // A spawn timer is időfüggő lett
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

    let i = this.items.length - 1;
    while (i >= 0) {
      const item = this.items[i];
      // A mozgást megszorozzuk a timeScale-lel
      item.y += item.speed * difficulty * timeScale;

      const inX = item.x > this.glassX && item.x < this.glassX + this.glassW;
      const inY = item.y + item.radius > glassTop && item.y - item.radius < glassBottom;

      if (inX && inY) {
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
        this.cdr.markForCheck(); // Csak ezt a komponenst frissítse
        if (this.fillPercent >= 100) this.endGame(true);
      });

      if (this.fillPercent !== this.lastRenderedFill) {
        this.prerenderLiquid();
      }
    }
  }

  private spawnItem(): void {
    const rand      = Math.random();
    const badChance = Math.min(0.50, 0.25 + (30 - this.timeLeft) * 0.015);

    let type: 'drop' | 'ice' | 'bad';
    if (rand < badChance)                              type = 'bad';
    else if (rand < badChance + (1 - badChance) / 2) type = 'ice';
    else                                              type = 'drop';

    const radius = type === 'bad' ? 32 : type === 'ice' ? 22 : 18;
    this.items.push({
      x:     Math.random() * (this.CANVAS_W - radius * 2) + radius,
      y:     -40,
      speed: 3.0 + Math.random() * 3.0,
      type,
      radius,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const H   = this.CANVAS_H;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, this.CANVAS_W, H);

    const gx = Math.floor(this.glassX);
    const gy = Math.floor(H - 130);

    if (this.liquidOffscreen) {
      ctx.drawImage(this.liquidOffscreen, gx, gy);
    }

    const glassBitmap = this.fillPercent >= 80
      ? this.glassGlowOffscreen 
      : this.glassOffscreen;     

    if (glassBitmap) {
      ctx.drawImage(glassBitmap, gx - 8 - this.SHADOW_PAD, gy - 8 - this.SHADOW_PAD);
    } else {
      ctx.drawImage(this.imgGlass, gx - 8, gy - 8, this.GW_PADDED, this.GH_PADDED);
    }

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

  private endGame(won: boolean): void {
    this.stopGame();
    this.zone.run(() => {
      this.state = won ? 'won' : 'lost';
      this.cdr.markForCheck(); // Végeredmény frissítése
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

  private onTouchEnd(): void {
    this.isDragging = false;
  }

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

  private onMouseUp(): void {
    this.isDragging = false;
  }

  retry(): void {
    this.state = 'idle';
  }
}