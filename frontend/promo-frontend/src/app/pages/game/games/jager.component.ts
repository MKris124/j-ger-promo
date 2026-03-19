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

  private glassW = 70;
  private glassH = 90;
  private glassX = 0;
  private isDragging = false;

  private items: FallingItem[] = [];
  private spawnTimer = 0;
  private spawnInterval = 40;
  private frameCount = 0;

  private readonly CANVAS_W = 390;
  private readonly CANVAS_H = 680;

  private readonly FILL_PER_DROP = 5;
  private readonly FILL_PER_ICE = 3;
  private readonly FILL_PER_BAD = -15;

  private imgGlass = new Image();
  private imgIce = new Image();
  private imgBroken = new Image();
  private imgDrop = new Image();
  private imagesLoaded = 0;

  private boundTouchStart = this.onTouchStart.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);
  private boundMouseDown = this.onMouseDown.bind(this);
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);

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
      this.ctx = this.canvas.getContext('2d', { alpha: false })!;
      this.canvas.width = this.CANVAS_W;
      this.canvas.height = this.CANVAS_H;

      this.glassX = this.CANVAS_W / 2 - this.glassW / 2;
      this.setupInputs();
      this.startTimer();
      this.zone.runOutsideAngular(() => this.gameLoop());
    }, 50);
  }

  private setupInputs(): void {
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundTouchEnd);
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);
  }

  // --- ÚJ, KÖZÉPPONTOS POZÍCIÓSZÁMÍTÓ ---
  private updateGlassPosition(clientX: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const pointerX = (clientX - rect.left) * (this.CANVAS_W / rect.width);
    const targetX = pointerX - (this.glassW / 2); // A pohár közepe legyen az ujjnál
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, targetX));
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.updateGlassPosition(e.touches[0].clientX);
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    this.updateGlassPosition(e.touches[0].clientX);
  }

  private onTouchEnd(): void { this.isDragging = false; }

  private onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.updateGlassPosition(e.clientX);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.updateGlassPosition(e.clientX);
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

    if (rand < 0.60) {
      type = 'drop';
    } else if (rand < 0.85) {
      type = 'ice';
    } else {
      type = 'bad';
    }

    this.items.push({
      x: Math.random() * (this.CANVAS_W - 60) + 30,
      y: -30,
      speed: (2.8 + Math.random() * 2.8),
      type,
      radius: type === 'ice' ? 24 : type === 'bad' ? 26 : 18,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const W = this.CANVAS_W;
    const H = this.CANVAS_H;

    // ── 1. HÁTTÉR ÉS RÁCS ───────────────────────────────────────────
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(243,112,33,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    const gx = this.glassX;
    const gy = H - 130;
    const gw = this.glassW;
    const gh = this.glassH;

    // ── 2. ÜRES POHÁR KIRAJZOLÁSA (Mögé) ────────────────────────────
    ctx.save();
    if (this.fillPercent >= 80) {
      ctx.shadowColor = '#F37021';
      ctx.shadowBlur = 15;
    }
    ctx.drawImage(this.imgGlass, gx - 8, gy - 8, gw + 16, gh + 16);
    ctx.restore();

    // ── 3. A 3D FOLYADÉK (PARABOLA BELSŐ FALAKKAL) ──────────────────
    const cx = gx + gw / 2 + 2;       
    const bottomY = gy + gh - 18;     
    const topY = gy + 10;             
    
    const bottomHalfW = 16.5;           
    const topHalfW = 21;            
    
    const curveOffset = -1.5; 
    
    const P0 = bottomHalfW;
    const P2 = topHalfW;
    const P1 = (P0 + P2) / 2 + curveOffset; 

    const maxFillHeight = bottomY - topY;
    const fillH = (this.fillPercent / 100) * maxFillHeight;

    if (fillH > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;

      const liquidTop = bottomY - fillH;

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
      shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      shineGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = shineGrad;
      ctx.fillRect(cx - topHalfW - 5, liquidTop - 5, topHalfW * 2 + 10, fillH + 15);

      ctx.restore();

      const t = fillH / maxFillHeight; 
      const currentHalfW = Math.pow(1 - t, 2) * P0 + 2 * (1 - t) * t * P1 + Math.pow(t, 2) * P2;

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(255, 170, 60, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, liquidTop, currentHalfW, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── 5. HULLÓ ELEMEK KIRAJZOLÁSA ─────────────────────────────────
    for (const item of this.items) {
      const s = item.radius * 2;

      
      if (item.type === 'drop') {
        this.ctx.drawImage(this.imgDrop, item.x - s * 0.5, item.y - s * 0.8, s, s * 1.4);
      } else if (item.type === 'ice') {
        this.ctx.drawImage(this.imgIce, item.x - s * 0.5, item.y - s * 0.5, s, s);
      } else {
        this.ctx.drawImage(this.imgBroken, item.x - s * 0.5, item.y - s * 0.5, s, s);
      }
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
      this.canvas.removeEventListener('touchstart', this.boundTouchStart);
      this.canvas.removeEventListener('touchmove', this.boundTouchMove);
      this.canvas.removeEventListener('touchend', this.boundTouchEnd);
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.canvas.removeEventListener('mousemove', this.boundMouseMove);
      this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  retry(): void { this.state = 'idle'; }
}