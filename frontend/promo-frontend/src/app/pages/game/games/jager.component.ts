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
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private zone = inject(NgZone);

  state: GameState = 'idle';
  fillPercent = 0;
  timeLeft = 30;
  score = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any = null;

  private glassX = 0;
  private glassW = 70;
  private glassH = 90;
  private isDragging = false;
  private dragOffsetX = 0;

  private items: FallingItem[] = [];
  private spawnTimer = 0;
  private spawnInterval = 40;
  private frameCount = 0;

  private readonly CANVAS_W = 390;
  private readonly CANVAS_H = 680;
  
  // --- NEHEZÍTÉS 1: Kisebb töltődés elemenként ---
  private readonly FILL_PER_DROP = 5;  // 8 helyett 5
  private readonly FILL_PER_ICE = 3;   // 5 helyett 3
  private readonly FILL_PER_BAD = -15; // Marad -15

  // Képek
  private imgGlass = new Image();
  private imgIce = new Image();
  private imgBroken = new Image();
  private imgDrop = new Image();
  private imagesLoaded = 0;

  ngOnInit(): void {
    this.imgGlass.src = 'assets/glass.png';
    this.imgIce.src = 'assets/ice.png';
    this.imgBroken.src = 'assets/broken.png';
    this.imgDrop.src = 'assets/drop.png';
    [this.imgGlass, this.imgIce, this.imgBroken, this.imgDrop]
      .forEach(img => img.onload = () => this.imagesLoaded++);
  }

  ngOnDestroy(): void { this.stopGame(); }

  startGame(): void {
    this.state = 'playing';
    this.fillPercent = 0;
    this.timeLeft = 30;
    this.score = 0;
    this.items = [];
    this.frameCount = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 40;

    setTimeout(() => {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d')!;
      this.canvas.width = this.CANVAS_W;
      this.canvas.height = this.CANVAS_H;
      this.glassX = this.CANVAS_W / 2 - this.glassW / 2;
      this.setupInputs();
      this.startTimer();
      this.zone.runOutsideAngular(() => this.gameLoop());
    }, 50);
  }

  private setupInputs(): void {
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.isDragging = true;
    this.dragOffsetX = tx - this.glassX;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, tx - this.dragOffsetX));
  }

  private onTouchEnd(): void { this.isDragging = false; }

  private onMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.isDragging = true;
    this.dragOffsetX = mx - this.glassX;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, mx - this.dragOffsetX));
  }

  private onMouseUp(): void { this.isDragging = false; }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.endGame(false); }
      });
    }, 1000);
  }

  private gameLoop(): void {
    if (this.state !== 'playing') return;
    this.update();
    this.render();
    this.animFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private update(): void {
    this.frameCount++;
    this.spawnTimer++;

    const elapsed = 30 - this.timeLeft;
    const difficulty = 1 + elapsed * 0.04;

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(15, 40 - elapsed * 2);
      this.spawnItem(difficulty);
    }

    const glassTop = this.CANVAS_H - 130;
    const glassBottom = glassTop + this.glassH;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * difficulty;

      const inX = item.x > this.glassX + 5 && item.x < this.glassX + this.glassW - 5;
      const inY = item.y + item.radius > glassTop && item.y - item.radius < glassBottom;

      if (inX && inY) {
        this.items.splice(i, 1);
        this.zone.run(() => {
          if (item.type === 'drop') {
            this.fillPercent = Math.min(100, this.fillPercent + this.FILL_PER_DROP);
            this.score++;
          } else if (item.type === 'ice') {
            this.fillPercent = Math.min(100, this.fillPercent + this.FILL_PER_ICE);
            this.score++;
          } else {
            this.fillPercent = Math.max(0, this.fillPercent + this.FILL_PER_BAD);
          }
          if (this.fillPercent >= 100) this.endGame(true);
        });
        continue;
      }

      if (item.y > this.CANVAS_H + 20) this.items.splice(i, 1);
    }
  }

  private spawnItem(difficulty: number): void {
    const rand = Math.random();
    let type: 'drop' | 'ice' | 'bad';
    if (rand < 0.42) type = 'drop';
    else if (rand < 0.62) type = 'ice';
    else type = 'bad';

    this.items.push({
      x: Math.random() * (this.CANVAS_W - 60) + 30,
      y: -30, 
      // VISSZAÁLLÍTVA AZ EREDETI SEBESSÉGRE:
      speed: (2.8 + Math.random() * 2.8), 
      type,
      radius: type === 'ice' ? 24 : type === 'bad' ? 26 : 18,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const W = this.CANVAS_W;
    const H = this.CANVAS_H;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Finom grid
    ctx.strokeStyle = 'rgba(243,112,33,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Pohár pozíció
    const gx = this.glassX;
    const gy = H - 130;
    const gw = this.glassW;
    const gh = this.glassH;

    // --- MEGJELENÍTÉS JAVÍTÁSA: Pohár kép alulra ---
    ctx.save();
    if (this.fillPercent >= 80) { ctx.shadowColor = '#F37021'; ctx.shadowBlur = 20; }
    ctx.drawImage(this.imgGlass, gx - 8, gy - 8, gw + 16, gh + 16);
    ctx.restore();

    // --- MEGJELENÍTÉS JAVÍTÁSA: Folyadék szint a pohár ELÉ ---
    const maxFillHeight = gh - 12;
    const fillH = (this.fillPercent / 100) * maxFillHeight;
    
    if (fillH > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply'; 
      ctx.globalAlpha = 0.85; 
      
      const grad = ctx.createLinearGradient(gx, gy + gh - fillH, gx, gy + gh);
      grad.addColorStop(0, 'rgba(243,112,33,1)');
      grad.addColorStop(1, 'rgba(160,60,5,1)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(gx + 6, gy + gh - fillH - 4, gw - 12, fillH, [0, 0, 8, 8]);
      ctx.fill();
      ctx.restore();
    }

    // Esési elemek
    for (const item of this.items) {
      ctx.save();
      const s = item.radius * 2;

      if (item.type === 'drop') {
        // Jäger csepp — pontosan ugyanaz a filter, mint a HTML-ben
        ctx.filter = 'drop-shadow(0px 2px 6px rgba(243,112,33,0.6)) invert(1) sepia(1) saturate(5) hue-rotate(340deg) brightness(1.1)';
        ctx.drawImage(this.imgDrop, item.x - s * 0.5, item.y - s * 0.8, s, s * 1.4);
        
      } else if (item.type === 'ice') {
        // Jégkocka — hideg kék árnyék
        ctx.filter = 'drop-shadow(0px 0px 8px rgba(59,130,246,0.5))';
        ctx.drawImage(this.imgIce, item.x - s * 0.5, item.y - s * 0.5, s, s);
        
      } else {
        // Törött pohár — pirosas árnyék és egy pici átlátszóság
        ctx.globalAlpha = 0.8;
        ctx.filter = 'drop-shadow(0px 0px 8px rgba(248,113,113,0.8))';
        ctx.drawImage(this.imgBroken, item.x - s * 0.5, item.y - s * 0.5, s, s);
        
        // Filter és átlátszóság kikapcsolása az X jel rajzolása előtt
        ctx.filter = 'none';
        ctx.globalAlpha = 1.0;

        // Piros ✕ jel középre, pont mint a HTML overlay-nél
        ctx.fillStyle = '#ef4444'; // Tailwind red-500
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText('✕', item.x, item.y);
      }
      
      ctx.restore(); // Ez állítja vissza a ctx-et a következő elemhez
    }
  }

  private endGame(won: boolean): void {
    this.stopGame();
    this.zone.run(() => {
      this.state = won ? 'won' : 'lost';
      if (won) this.gameWon.emit();
      else this.gameLost.emit();
    });
  }

  private stopGame(): void {
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
      this.canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
      this.canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  retry(): void { this.state = 'idle'; }
}