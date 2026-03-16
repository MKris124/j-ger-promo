import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Input, Output, EventEmitter, NgZone
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

  // Emittálja a végeredményt a szülő game komponensnek
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private zone = inject(NgZone);

  // --- Játék állapot ---
  state: GameState = 'idle';
  fillPercent = 0;        // 0-100, pohár töltöttsége
  timeLeft = 15;          // másodpercek
  score = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any = null;

  // --- Pohár pozíció ---
  private glassX = 0;
  private glassW = 70;
  private glassH = 90;
  private isDragging = false;
  private dragOffsetX = 0;
  private lastTouchX = 0;

  // --- Esési elemek ---
  private items: FallingItem[] = [];
  private spawnTimer = 0;
  private spawnInterval = 60; // frame-enként
  private frameCount = 0;

  // Játék paraméterei
  private readonly CANVAS_W = 390;
  private readonly CANVAS_H = 680;
  private readonly FILL_PER_DROP = 8;
  private readonly FILL_PER_ICE = 5;
  private readonly FILL_PER_BAD = -12;

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopGame();
  }

  startGame(): void {
    this.state = 'playing';
    this.fillPercent = 0;
    this.timeLeft = 30;
    this.score = 0;
    this.items = [];
    this.frameCount = 0;
    this.spawnTimer = 0;

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
    // Touch
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    // Mouse (desktop teszteléshez)
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.lastTouchX = tx;
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
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endGame(false);
        }
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

    // Nehézség növelése idővel
    const elapsed = 30 - this.timeLeft;
    const difficulty = 1 + elapsed * 0.03;

    // Spawn
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(25, 60 - elapsed * 1.5);
      this.spawnItem(difficulty);
    }

    // Mozgatás és ütközés
    const glassTop = this.CANVAS_H - 120;
    const glassBottom = glassTop + this.glassH;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * difficulty;

      // Ütközés a pohárral
      const inX = item.x > this.glassX && item.x < this.glassX + this.glassW;
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

      // Kiesett alul
      if (item.y > this.CANVAS_H + 20) {
        this.items.splice(i, 1);
      }
    }
  }

  private spawnItem(difficulty: number): void {
    const rand = Math.random();
    let type: 'drop' | 'ice' | 'bad';
    if (rand < 0.5) type = 'drop';
    else if (rand < 0.75) type = 'ice';
    else type = 'bad';

    this.items.push({
      x: Math.random() * (this.CANVAS_W - 40) + 20,
      y: -20,
      speed: (2 + Math.random() * 2) * difficulty,
      type,
      radius: type === 'ice' ? 14 : 12,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const W = this.CANVAS_W;
    const H = this.CANVAS_H;

    // Háttér
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Grid háttér
    ctx.strokeStyle = 'rgba(243,112,33,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Esési elemek
    for (const item of this.items) {
      ctx.save();
      if (item.type === 'drop') {
        // Jäger csepp — narancs
        ctx.fillStyle = '#F37021';
        ctx.shadowColor = '#F37021';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
        // J betű
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('J', item.x, item.y);
      } else if (item.type === 'ice') {
        // Jégkocka — kék/fehér
        ctx.fillStyle = '#a8d8ea';
        ctx.strokeStyle = '#e0f4ff';
        ctx.lineWidth = 1.5;
        const s = item.radius * 1.8;
        ctx.beginPath();
        ctx.roundRect(item.x - s / 2, item.y - s / 2, s, s, 4);
        ctx.fill();
        ctx.stroke();
        // Jég jel
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('*', item.x, item.y);
      } else {
        // Rossz elem — piros X
        ctx.fillStyle = '#e05252';
        ctx.shadowColor = '#e05252';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        const r = item.radius * 0.55;
        ctx.beginPath();
        ctx.moveTo(item.x - r, item.y - r); ctx.lineTo(item.x + r, item.y + r);
        ctx.moveTo(item.x + r, item.y - r); ctx.lineTo(item.x - r, item.y + r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Pohár
    const gx = this.glassX;
    const gy = H - 120;
    const gw = this.glassW;
    const gh = this.glassH;

    // Folyadék szint a pohárban
    const fillH = (this.fillPercent / 100) * (gh - 10);
    ctx.fillStyle = `rgba(243,112,33,${0.3 + (this.fillPercent / 100) * 0.5})`;
    ctx.beginPath();
    ctx.roundRect(gx + 4, gy + gh - fillH - 5, gw - 8, fillH, [0, 0, 4, 4]);
    ctx.fill();

    // Pohár körvonal
    ctx.strokeStyle = this.fillPercent >= 80 ? '#F37021' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = this.fillPercent >= 80 ? '#F37021' : 'transparent';
    ctx.shadowBlur = this.fillPercent >= 80 ? 12 : 0;
    ctx.beginPath();
    ctx.moveTo(gx + 8, gy);
    ctx.lineTo(gx + 4, gy + gh);
    ctx.lineTo(gx + gw - 4, gy + gh);
    ctx.lineTo(gx + gw - 8, gy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // J betű a pohárra
    ctx.fillStyle = 'rgba(243,112,33,0.6)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('J', gx + gw / 2, gy + gh / 2);
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
    // Remove listeners
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
      this.canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
      this.canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  retry(): void {
    this.state = 'idle';
  }
}