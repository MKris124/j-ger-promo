import {
  Component, OnInit, OnDestroy, ElementRef,
  ViewChild, inject, Output, EventEmitter, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Interfész az eső elemeknek
interface FallingItem {
  x: number;
  y: number;
  speed: number;
  type: 'drop' | 'ice' | 'bad';
  radius: number;
}

// Játék állapotok
type GameState = 'idle' | 'playing' | 'won' | 'lost';

@Component({
  selector: 'app-catch-jager',
  standalone: true,
  imports: [CommonModule],
  // Feltételezem, hogy a HTML-ed egy külön fájlban van:
  templateUrl: './catch-the-jager.component.html',
})
export class CatchTheJagerComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  // Injektáljuk az NgZone-t a teljesítmény optimalizáláshoz
  private zone = inject(NgZone);

  // UI kötött változók
  state: GameState = 'idle';
  fillPercent = 0;
  timeLeft = 30;
  score = 0;

  // Canvas változók
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private timerInterval: any = null;

  // Pohár adatai
  private glassX = 0;
  private glassW = 70;
  private glassH = 90;
  private isDragging = false;
  private dragOffsetX = 0;

  // Játék logika változók
  private items: FallingItem[] = [];
  private spawnTimer = 0;
  private spawnInterval = 40; // framenkénti generálás
  private frameCount = 0;

  // Konstansok
  private readonly CANVAS_W = 390;
  private readonly CANVAS_H = 680;
  private readonly FILL_PER_DROP = 7;
  private readonly FILL_PER_ICE = 4;
  private readonly FILL_PER_BAD = -15;

  // Képek
  private imgGlass = new Image();
  private imgIce = new Image();
  private imgBroken = new Image();
  private imgDrop = new Image();
  private imagesLoaded = 0;

  ngOnInit(): void {
    // Képek betöltése (biztosítjuk, hogy az assets mappában ott legyenek)
    this.imgGlass.src = 'assets/glass.png';
    this.imgIce.src = 'assets/ice.png';
    this.imgBroken.src = 'assets/broken.png';
    this.imgDrop.src = 'assets/drop.png'; // Feltételezve, hogy a drop.png is ott van

    [this.imgGlass, this.imgIce, this.imgBroken, this.imgDrop].forEach(img => {
      img.onload = () => this.imagesLoaded++;
    });
  }

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

    // Kicsi timeout, hogy a canvas meg tudjon jelenni a DOM-ban
    setTimeout(() => {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d')!;
      this.canvas.width = this.CANVAS_W;
      this.canvas.height = this.CANVAS_H;
      this.glassX = this.CANVAS_W / 2 - this.glassW / 2;

      this.setupInputs();
      this.startTimer();

      // --- KRITIKUS OPTIMALIZÁLÁS MOBILRA ---
      // A játék loopját (requestAnimationFrame) KÍVÜL indítjuk az Angular zónán.
      // Így az Angular nem futtat Change Detectiont másodpercenként 60-szor.
      this.zone.runOutsideAngular(() => {
        this.gameLoop();
      });
    }, 50);
  }

  // Időzítő
  private startTimer(): void {
    // Az időzítőt bent tarthatjuk az Angular zónában, mert csak 1s-enként fut
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

  // Fő játék loop (A zónán kívül fut!)
  private gameLoop(): void {
    if (this.state !== 'playing') return;

    this.update(); // Számolás
    this.render(); // Rajzolás

    // Következő frame kérése
    this.animFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  // Számolási logika
  private update(): void {
    this.frameCount++;
    this.spawnTimer++;

    // --- NEHEZÍTÉS: Gyorsabban nő a nehézségi szorzó (0.04 helyett 0.05) ---
    const elapsed = 30 - this.timeLeft;
    const difficulty = 1 + elapsed * 0.05;

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // --- NEHEZÍTÉS: Gyorsabb potyogás! (Alap 35 frame, és lemehet akár 12-re is) ---
      this.spawnInterval = Math.max(12, 35 - elapsed * 2);
      this.spawnItem(difficulty);
    }

    const glassTop = this.CANVAS_H - 130;
    const glassBottom = glassTop + this.glassH;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * difficulty;

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

          if (this.fillPercent >= 100) {
            this.endGame(true);
          }
        });
        continue;
      }

      if (item.y > this.CANVAS_H + 20) {
        this.items.splice(i, 1);
      }
    }
  }

  // Új elem létrehozása
  private spawnItem(difficulty: number): void {
    const rand = Math.random();
    let type: 'drop' | 'ice' | 'bad';
    
    // --- NEHEZÍTÉS: Több piros X! Induláskor 25% esély, a végére felmegy 50%-ra ---
    const badChance = Math.min(0.50, 0.25 + (30 - this.timeLeft) * 0.015);

    if (rand < badChance) { type = 'bad'; }
    else if (rand < badChance + (1 - badChance) / 2) { type = 'ice'; }
    else { type = 'drop'; }

    // --- NEHEZÍTÉS ÉS MÉRETEK ---
    // A 'bad' (törött pohár) sugara 32 lett (vagyis 64x64 pixel széles/magas lesz)!
    // A jégkocka 22 (44x44), a csepp 18 (36x36)
    const radius = type === 'bad' ? 32 : type === 'ice' ? 22 : 18;

    this.items.push({
      // Úgy generáljuk az X koordinátát, hogy a nagy pohár se lógjon le a képernyő széléről
      x: Math.random() * (this.CANVAS_W - radius * 2) + radius, 
      y: -40, // Magasabbról indul, hogy ne "ugorjon" be a képbe
      speed: (3.0 + Math.random() * 3.0), // Kicsivel emelt alap sebesség
      type,
      radius: radius,
    });
  }

  // Rajzolási logika (A zónán kívül fut!)
  private render(): void {
    const ctx = this.ctx;
    const W = this.CANVAS_W;
    const H = this.CANVAS_H;

    // Háttér törlése
    ctx.fillStyle = '#0d0d0d'; // sötét háttér
    ctx.fillRect(0, 0, W, H);

    // Finom rács rajzolása a háttérre
    ctx.strokeStyle = 'rgba(243,112,33,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Pohár pozíció (Y fix)
    const gx = this.glassX;
    const gy = H - 130;
    const gw = this.glassW;
    const gh = this.glassH;

    // 1. Folyadék szint rajzolása (pohár mögött)
    const fillH = (this.fillPercent / 100) * (gh - 15); // margin az alján/tetején
    if (fillH > 0) {
      const grad = ctx.createLinearGradient(gx, gy + gh - fillH, gx, gy + gh);
      grad.addColorStop(0, 'rgba(243,112,33,0.85)'); // Jager narancs
      grad.addColorStop(1, 'rgba(160,60,5,0.9)');    // Sötétebb alj
      ctx.fillStyle = grad;
      ctx.beginPath();
      // Lekerekített folyadék alj
      ctx.roundRect(gx + 8, gy + gh - fillH - 2, gw - 16, fillH, [0, 0, 4, 4]);
      ctx.fill();
    }

    // 2. Pohár rajzolása (Kép alapján)
    ctx.drawImage(this.imgGlass, gx - 8, gy - 8, gw + 16, gh + 16);

    // 3. Esési elemek rajzolása
    // Esési elemek (MOBIL OPTIMALIZÁLT RENDER)
    for (const item of this.items) {
      // Nincs szükség ctx.save() / ctx.restore() / ctx.filter hívásokra!
      const s = item.radius * 2;

      if (item.type === 'drop') {
        // Ha a drop.png eleve narancssárga és áttetsző, csak rajzold ki
        this.ctx.drawImage(this.imgDrop, item.x - s * 0.5, item.y - s * 0.8, s, s * 1.4);
      } else if (item.type === 'ice') {
        // Jégkocka
        this.ctx.drawImage(this.imgIce, item.x - s * 0.5, item.y - s * 0.5, s, s);
      } else {
        // Törött pohár
        this.ctx.drawImage(this.imgBroken, item.x - s * 0.5, item.y - s * 0.5, s, s);
        
        // Az X jelet bent tarthatod, vagy ha a képen rajta van, ezt is törölheted:
        const r = s * 0.3;
        this.ctx.beginPath();
        this.ctx.moveTo(item.x - r, item.y - r); this.ctx.lineTo(item.x + r, item.y + r);
        this.ctx.moveTo(item.x + r, item.y - r); this.ctx.lineTo(item.x - r, item.y + r);
        this.ctx.stroke();
      }
    }
  }

  // Játék vége
  private endGame(won: boolean): void {
    this.stopGame();
    // Visszatérünk az Angular zónába, hogy frissítsük a state-et a HTML-ben
    this.zone.run(() => {
      this.state = won ? 'won' : 'lost';
      if (won) {
        this.gameWon.emit();
      } else {
        this.gameLost.emit();
      }
    });
  }

  private stopGame(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.removeInputs();
  }

  // --- Bemeneti kezelők optimalizálása ---
  // A touch eventeket is ki kell vinnünk a zónából a simább húzásért.

  private setupInputs(): void {
    if (!this.canvas) return;
    
    // Zónán kívüli eventek
    this.zone.runOutsideAngular(() => {
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
      
      // PC egér események (opcionális)
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    });
  }

  private removeInputs(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));
    this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
  }

  // --- Input logika (A zónán kívül fut!) ---

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) * (this.CANVAS_W / rect.width);
    
    if (tx > this.glassX - 20 && tx < this.glassX + this.glassW + 20) {
      this.isDragging = true;
      this.dragOffsetX = tx - this.glassX;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) * (this.CANVAS_W / rect.width);
    
    // Pohár pozíció frissítése (csak X tengelyen)
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, tx - this.dragOffsetX));
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  // Egér logika (hasonló a touch-hoz)
  private onMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.CANVAS_W / rect.width);
    if (mx > this.glassX - 20 && mx < this.glassX + this.glassW + 20) {
      this.isDragging = true;
      this.dragOffsetX = mx - this.glassX;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.CANVAS_W / rect.width);
    this.glassX = Math.max(0, Math.min(this.CANVAS_W - this.glassW, mx - this.dragOffsetX));
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  // Vissza az elejére
  retry(): void {
    this.state = 'idle';
  }
}