import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Output, EventEmitter, NgZone,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

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
  assetsReady  = false;
  canvasScale  = 1;

  private readonly CANVAS_W = 320;
  private readonly CANVAS_H = 680;
  private readonly GLASS_W  = 70;

  // ── WORKER ───────────────────────────────────────────────────────────────
  // A teljes render + fizika loop a worker threadre kerül.
  // A főszál csak: input kezelés, timer, Angular UI frissítés.
  private worker!: Worker;

  private canvas!: HTMLCanvasElement;
  private timerInterval: any = null;

  private glassX       = 0;
  private isDragging   = false;
  private dragOffsetX  = 0;
  private cachedRect!: DOMRect;
  private cachedScaleX = 1;

  private readonly boundResizeObserver = new ResizeObserver(() => this.updateRect());

  private readonly boundTouchStart = this.onTouchStart.bind(this);
  private readonly boundTouchMove  = this.onTouchMove.bind(this);
  private readonly boundTouchEnd   = this.onTouchEnd.bind(this);
  private readonly boundMouseDown  = this.onMouseDown.bind(this);
  private readonly boundMouseMove  = this.onMouseMove.bind(this);
  private readonly boundMouseUp    = this.onMouseUp.bind(this);

  // Bitmapek — ngOnInit-ban töltjük, startGame() megvárja
  private bitmapGlass!:  ImageBitmap;
  private bitmapGlow!:   ImageBitmap;
  private bitmapDrop!:   ImageBitmap;
  private bitmapIce!:    ImageBitmap;
  private bitmapBad!:    ImageBitmap;
  private assetsReadyPromise!: Promise<void>;

  private readonly imgGlass  = new Image();
  private readonly imgIce    = new Image();
  private readonly imgBroken = new Image();
  private readonly imgDrop   = new Image();

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

    this.assetsReadyPromise = Promise.all([
      toBitmap(this.imgGlass),
      toBitmap(this.imgGlass),  // glow ugyanaz az alap kép, worker csinálja a glow effektet
      toBitmap(this.imgDrop),
      toBitmap(this.imgIce),
      toBitmap(this.imgBroken),
    ]).then(([glass, glow, drop, ice, bad]) => {
      this.bitmapGlass = glass;
      this.bitmapGlow  = glow;
      this.bitmapDrop  = drop;
      this.bitmapIce   = ice;
      this.bitmapBad   = bad;
    }).then(() => {
      this.zone.run(() => {
        this.assetsReady = true;
        this.cdr.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    this.stopGame();
    this.boundResizeObserver.disconnect();
    this.worker?.terminate();
  }

  startGame(): void {
    this.state       = 'playing';
    this.fillPercent = 0;
    this.timeLeft    = 30;
    this.score       = 0;
    this.glassX      = this.CANVAS_W / 2 - this.GLASS_W / 2;

    this.assetsReadyPromise.then(() => {
      setTimeout(() => {
        this.canvas = this.canvasRef.nativeElement;
        this.canvas.width  = this.CANVAS_W;
        this.canvas.height = this.CANVAS_H;
        this.canvas.style.imageRendering = 'pixelated';

        this.updateRect();
        this.boundResizeObserver.observe(this.canvas);
        this.setupInputs();

        // OffscreenCanvas átadása a workernek — zero-copy transzfer
        const offscreen = this.canvas.transferControlToOffscreen();

        // Worker példányosítás (Angular CLI new Worker szintaxis)
        if (this.worker) this.worker.terminate();
        this.worker = new Worker(new URL('./game.worker', import.meta.url), { type: 'module' });

        // Worker üzenetek kezelése — fill/score változások a UI-ba
        this.worker.onmessage = (e) => this.onWorkerMessage(e.data);

        // Init: canvas + bitmapek átküldése a workernek (transferable)
        this.worker.postMessage({
          type: 'init',
          canvas: offscreen,
          canvasW: this.CANVAS_W,
          canvasH: this.CANVAS_H,
          bitmaps: {
            glass: this.bitmapGlass,
            glow:  this.bitmapGlow,
            drop:  this.bitmapDrop,
            ice:   this.bitmapIce,
            bad:   this.bitmapBad,
          }
        }, [
          // Transferable objects — zero-copy, nem másolja a memóriát
          offscreen,
          this.bitmapGlass,
          this.bitmapGlow,
          this.bitmapDrop,
          this.bitmapIce,
          this.bitmapBad,
        ]);

        this.worker.postMessage({ type: 'start' });
        this.startTimer();
        this.cdr.markForCheck();
      }, 50);
    });
  }

  private onWorkerMessage(msg: any): void {
    // Worker üzenetek jönnek — minimális Angular zone érintkezés
    switch (msg.type) {
      case 'fill':
        // fillPercent frissítés zónán kívül, csak markForCheck
        this.fillPercent = msg.value;
        this.cdr.markForCheck();
        break;
      case 'score':
        this.score += msg.delta;
        this.cdr.markForCheck();
        break;
      case 'won':
        this.zone.run(() => {
          this.stopGame();
          this.state = 'won';
          this.cdr.markForCheck();
          this.gameWon.emit();
        });
        break;
      case 'lost':
        this.zone.run(() => {
          this.stopGame();
          this.state = 'lost';
          this.cdr.markForCheck();
          this.gameLost.emit();
        });
        break;
    }
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.timeLeft--;
        // Timeot szinkronizáljuk a workerrel
        this.worker?.postMessage({ type: 'timeLeft', value: this.timeLeft });
        this.cdr.markForCheck();
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.stopGame();
          this.state = 'lost';
          this.cdr.markForCheck();
          this.gameLost.emit();
        }
      });
    }, 1000);
  }

  private stopGame(): void {
    this.worker?.postMessage({ type: 'stop' });
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.removeInputs();
  }

  private updateRect(): void {
    const HUD_HEIGHT  = 56;
    const HINT_HEIGHT = 28;
    const parentW     = this.canvas?.parentElement?.clientWidth ?? this.CANVAS_W;
    const availableH  = window.innerHeight - HUD_HEIGHT - HINT_HEIGHT;

    this.canvasScale = Math.min(1, parentW / this.CANVAS_W, availableH / this.CANVAS_H);
    this.cachedRect   = this.canvas.getBoundingClientRect();
    this.cachedScaleX = this.CANVAS_W / this.cachedRect.width;
    this.cdr.markForCheck();
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

  private sendGlassX(): void {
    // Pohár pozíció küldése a workernek — a worker azonnal alkalmazza
    this.worker?.postMessage({ type: 'glassX', x: this.glassX });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const tx    = (touch.clientX - this.cachedRect.left) * this.cachedScaleX;
    if (tx > this.glassX - 20 && tx < this.glassX + this.GLASS_W + 20) {
      this.isDragging  = true;
      this.dragOffsetX = tx - this.glassX;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    const touch = e.touches[0];
    const tx    = (touch.clientX - this.cachedRect.left) * this.cachedScaleX;
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.GLASS_W, tx - this.dragOffsetX));
    this.sendGlassX();
  }

  private onTouchEnd(): void { this.isDragging = false; }

  private onMouseDown(e: MouseEvent): void {
    const mx = (e.clientX - this.cachedRect.left) * this.cachedScaleX;
    if (mx > this.glassX - 20 && mx < this.glassX + this.GLASS_W + 20) {
      this.isDragging  = true;
      this.dragOffsetX = mx - this.glassX;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const mx    = (e.clientX - this.cachedRect.left) * this.cachedScaleX;
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.GLASS_W, mx - this.dragOffsetX));
    this.sendGlassX();
  }

  private onMouseUp(): void { this.isDragging = false; }

  retry(): void { this.state = 'idle'; }
}