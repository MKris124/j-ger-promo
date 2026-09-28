import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

type MoleType = 'good' | 'bad';
type GameState = 'idle' | 'playing' | 'won' | 'lost';

interface ConfettiPiece {
  emoji: string;
  left: number;
  delay: number;
  duration: number;
}

@Component({
  selector: 'app-whac-a-mole',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whac-a-mole.component.html',
})
export class WhacAMoleComponent implements OnDestroy {
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private readonly GRID_SIZE = 9;
  readonly ROUND_SECONDS = 45; // a template is használja (idle szöveg)
  readonly WIN_SCORE = 16; // a template is használja (pontszám kijelzés)
  private readonly GOOD_POINTS = 1;
  private readonly BAD_PENALTY = 2;
  private readonly CONFETTI_EMOJI = ['🎉', '🎊', '🍀', '⭐', '🥃'];

  // Nehézségi görbe végpontjai — a teljes kör hosszára arányosítva, nem fix
  // másodpercenkénti csökkentéssel, hogy a "beelőzés" a JÁTÉKIDŐ EGÉSZÉRE elosztva történjen
  private readonly SPAWN_INTERVAL_START_MS = 900;
  private readonly SPAWN_INTERVAL_END_MS = 280;
  private readonly MOLE_UP_DURATION_START_MS = 1100;
  private readonly MOLE_UP_DURATION_END_MS = 420;
  private readonly BAD_CHANCE_START = 0.15;
  private readonly BAD_CHANCE_END = 0.45;

  private spawnTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private retractTimeouts: (ReturnType<typeof setTimeout> | null)[] = Array(this.GRID_SIZE).fill(null);
  private spawnIntervalMs = this.SPAWN_INTERVAL_START_MS;
  private elapsedSeconds = 0;

  state: GameState = 'idle';
  holes: (MoleType | null)[] = Array(this.GRID_SIZE).fill(null);
  score = 0;
  timeLeft = this.ROUND_SECONDS;
  confetti: ConfettiPiece[] = [];

  get scorePercent(): number {
    return Math.min(100, (this.score / this.WIN_SCORE) * 100);
  }

  startGame(): void {
    this.state = 'playing';
    this.score = 0;
    this.timeLeft = this.ROUND_SECONDS;
    this.elapsedSeconds = 0;
    this.spawnIntervalMs = this.SPAWN_INTERVAL_START_MS;
    this.holes = Array(this.GRID_SIZE).fill(null);
    this.confetti = [];

    this.scheduleNextSpawn();
    this.countdownTimer = setInterval(() => this.tickCountdown(), 1000);
  }

  // 0 a kör elején, 1 a kör végén — minden nehézségi görbe ebből számol,
  // így a ROUND_SECONDS bármikor változtatható anélkül, hogy a görbét újra kéne hangolni
  private get progress(): number {
    return Math.min(1, this.elapsedSeconds / this.ROUND_SECONDS);
  }

  whack(index: number): void {
    if (this.state !== 'playing') return;
    const mole = this.holes[index];
    if (!mole) return;

    if (this.retractTimeouts[index]) {
      clearTimeout(this.retractTimeouts[index]!);
      this.retractTimeouts[index] = null;
    }
    this.holes[index] = null;

    if (mole === 'good') {
      this.score += this.GOOD_POINTS;
      navigator.vibrate?.(30);
    } else {
      this.score = Math.max(0, this.score - this.BAD_PENALTY);
      navigator.vibrate?.([50, 30, 50]);
    }

    if (this.score >= this.WIN_SCORE) {
      this.finish(true);
    }
  }

  private scheduleNextSpawn(): void {
    if (this.state !== 'playing') return;
    this.spawnTimer = setTimeout(() => {
      this.spawnMole();
      // Nehézségi görbe a TELJES kör hosszára elosztva — minél tovább tart a kör,
      // annál gyorsabban pörög fel a tempó a végéig
      this.spawnIntervalMs = this.SPAWN_INTERVAL_START_MS
          - this.progress * (this.SPAWN_INTERVAL_START_MS - this.SPAWN_INTERVAL_END_MS);
      this.scheduleNextSpawn();
    }, this.spawnIntervalMs);
  }

  private spawnMole(): void {
    const emptyIndexes = this.holes
      .map((m, i) => (m === null ? i : -1))
      .filter(i => i !== -1);
    if (emptyIndexes.length === 0) return;

    const idx = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
    // A "rossz" (törött pohár) esély is nő az idővel — egyre óvatosabban kell célozni
    const badChance = this.BAD_CHANCE_START + this.progress * (this.BAD_CHANCE_END - this.BAD_CHANCE_START);
    const type: MoleType = Math.random() < badChance ? 'bad' : 'good';
    this.holes[idx] = type;

    const upDurationMs = this.MOLE_UP_DURATION_START_MS
        - this.progress * (this.MOLE_UP_DURATION_START_MS - this.MOLE_UP_DURATION_END_MS);
    this.retractTimeouts[idx] = setTimeout(() => {
      if (this.holes[idx] === type) this.holes[idx] = null;
      this.retractTimeouts[idx] = null;
    }, upDurationMs);
  }

  private tickCountdown(): void {
    this.elapsedSeconds++;
    this.timeLeft--;
    if (this.timeLeft <= 0) {
      this.finish(this.score >= this.WIN_SCORE);
    }
  }

  private finish(isWin: boolean): void {
    this.state = isWin ? 'won' : 'lost';
    this.stopTimers();
    this.holes = Array(this.GRID_SIZE).fill(null);

    if (isWin) {
      this.celebrateWin();
      this.gameWon.emit();
    } else {
      this.gameLost.emit();
    }
  }

  private celebrateWin(): void {
    navigator.vibrate?.([120, 60, 120, 60, 200]);
    this.confetti = Array.from({ length: 16 }, () => ({
      emoji: this.CONFETTI_EMOJI[Math.floor(Math.random() * this.CONFETTI_EMOJI.length)],
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1 + Math.random() * 0.8,
    }));
  }

  private stopTimers(): void {
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.spawnTimer = null;
    this.countdownTimer = null;
    this.retractTimeouts.forEach(t => t && clearTimeout(t));
    this.retractTimeouts = Array(this.GRID_SIZE).fill(null);
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }

  retry(): void {
    this.state = 'idle';
    this.score = 0;
    this.timeLeft = this.ROUND_SECONDS;
    this.holes = Array(this.GRID_SIZE).fill(null);
    this.confetti = [];
  }
}
