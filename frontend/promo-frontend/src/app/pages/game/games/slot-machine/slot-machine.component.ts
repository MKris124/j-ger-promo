import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ReelSymbol {
  type: 'image' | 'emoji';
  value: string;
}

interface ConfettiPiece {
  emoji: string;
  left: number;
  delay: number;
  duration: number;
}

type GameState = 'idle' | 'pulling' | 'spinning' | 'won' | 'lost';

@Component({
  selector: 'app-slot-machine',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slot-machine.component.html',
})
export class SlotMachineComponent implements OnDestroy {
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  // Ha a komponens elpusztul menet közben (pl. elnavigál), ezeket törölni kell —
  // különben a timerek egy már eltűnt komponensen futnának tovább a háttérben
  private cycleIntervals: (ReturnType<typeof setInterval> | null)[] = [null, null, null];
  private autoStopTimeouts: (ReturnType<typeof setTimeout> | null)[] = [null, null, null];
  private finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;

  // A nyerés esélye NEM a reel-szimbólumok véletlenszerű egyezéséből jön —
  // előre eldől, a reel-ek csak ezt "játsszák le" vizuálisan (garantáltan
  // pontos, kontrollálható esély, klasszikus promó-gép trükk).
  private readonly BASE_WIN_CHANCE = 0.10;

  // "Telitalálat" Tökéletes Húzásnál megnöveli az esélyt — a második mini-játék tétje
  private readonly PERFECT_PULL_WIN_CHANCE = 0.25;

  // Vesztésnél ilyen eséllyel lesz szándékosan "majdnem" (2 egyforma + 1 más) —
  // ez a klasszikus "near miss" pszichológia, sokkal izgalmasabb mint a tiszta random
  private readonly NEAR_MISS_CHANCE = 0.55;

  // Ha a játékos nem nyom Állj-t, ennyi idő után magától megáll a dob —
  // biztonsági háló, hogy senki ne ragadjon be örökre pörgő állapotban
  private readonly AUTO_STOP_MS = [4000, 4600, 5200];

  readonly SWEET_SPOT_WIDTH = 16; // % — mekkora a célzóna a Tökéletes Húzás sávon (a template is használja)
  private readonly PULL_SPEED = 3.2; // % / tick — milyen gyorsan mozog a mutató

  private readonly STAG: ReelSymbol = { type: 'image', value: '/assets/stag.png' };
  private readonly SYMBOLS: ReelSymbol[] = [
    this.STAG,
    { type: 'emoji', value: '🍒' },
    { type: 'emoji', value: '🍋' },
    { type: 'emoji', value: '7️⃣' },
    { type: 'emoji', value: '💎' },
    { type: 'emoji', value: '🍀' },
  ];

  private readonly CONFETTI_EMOJI = ['🎉', '🎊', '🍀', '⭐', '🥃'];

  private finalSymbols: ReelSymbol[] = [];
  private pendingIsWin = false;
  private pendingNearMiss = false;
  private pullDirection = 1;

  state: GameState = 'idle';

  // --- Tökéletes Húzás (1. mini-játék) ---
  pullPosition = 0;
  sweetSpotStart = 0;
  perfectPull = false;
  pullLocked = false; // true = már megállt a mutató, a visszajelzést mutatjuk a pörgetés indulásáig

  // --- Nyerőgép (2. mini-játék) ---
  reels: ReelSymbol[] = [this.SYMBOLS[1], this.SYMBOLS[2], this.SYMBOLS[3]];
  spinningReels = [false, false, false];
  stoppedReels = [false, false, false];
  isNearMiss = false;
  confetti: ConfettiPiece[] = [];

  // ============== 1. TÖKÉLETES HÚZÁS ==============

  startPull(): void {
    this.state = 'pulling';
    this.perfectPull = false;
    this.pullLocked = false;
    this.pullPosition = 0;
    this.pullDirection = 1;
    // A célzóna minden körben máshol van — 10-74% között, hogy a sáv szélébe ne lógjon ki
    this.sweetSpotStart = 10 + Math.random() * (74 - 10);

    this.pullInterval = setInterval(() => {
      this.pullPosition += this.pullDirection * this.PULL_SPEED;
      if (this.pullPosition >= 100) { this.pullPosition = 100; this.pullDirection = -1; }
      if (this.pullPosition <= 0) { this.pullPosition = 0; this.pullDirection = 1; }
    }, 20);
  }

  lockPull(): void {
    if (this.state !== 'pulling') return;
    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = null;
    }

    this.perfectPull = this.pullPosition >= this.sweetSpotStart
        && this.pullPosition <= this.sweetSpotStart + this.SWEET_SPOT_WIDTH;
    this.pullLocked = true;
    navigator.vibrate?.(this.perfectPull ? [60, 40, 60, 40, 120] : 40);

    const winChance = this.perfectPull ? this.PERFECT_PULL_WIN_CHANCE : this.BASE_WIN_CHANCE;
    // Elég hosszú szünet, hogy a játékos TÉNYLEG el tudja olvasni a visszajelzést,
    // mielőtt pörögni kezd a gép — korábban 400/900ms volt, ez alig volt észrevehető
    setTimeout(() => this.beginSpin(winChance), this.perfectPull ? 1800 : 1200);
  }

  // ============== 2. NYERŐGÉP ==============

  private beginSpin(winChance: number): void {
    this.state = 'spinning';
    this.spinningReels = [true, true, true];
    this.stoppedReels = [false, false, false];
    this.isNearMiss = false;
    this.confetti = [];

    this.pendingIsWin = Math.random() < winChance;
    // Tökéletes Húzás után SOSE lehet "hideg" vesztés (0 szarvas) — ha nem nyer,
    // akkor garantáltan legalább majdnem-találat, hogy a mini-játék MINDIG érezhetően
    // fizessen valamit, ne csak egy láthatatlan valószínűség-eltolást
    const { symbols, nearMiss } = this.pickFinalSymbols(this.pendingIsWin, this.perfectPull);
    this.finalSymbols = symbols;
    this.pendingNearMiss = nearMiss;

    // Mindhárom dob egyszerre indul, a játékos SAJÁT MAGA dönti el mikor állítja meg
    // melyiket — nem egy automata időzítő teszi ezt helyette
    for (let i = 0; i < 3; i++) {
      this.cycleIntervals[i] = setInterval(() => {
        this.reels[i] = this.randomSymbol();
      }, 80);

      this.autoStopTimeouts[i] = setTimeout(() => this.stopReel(i), this.AUTO_STOP_MS[i]);
    }
  }

  stopReel(index: number): void {
    if (this.state !== 'spinning' || this.stoppedReels[index]) return;

    if (this.cycleIntervals[index]) {
      clearInterval(this.cycleIntervals[index]!);
      this.cycleIntervals[index] = null;
    }
    if (this.autoStopTimeouts[index]) {
      clearTimeout(this.autoStopTimeouts[index]!);
      this.autoStopTimeouts[index] = null;
    }

    this.reels[index] = this.finalSymbols[index];
    this.spinningReels[index] = false;
    this.stoppedReels[index] = true;
    navigator.vibrate?.(40);

    if (this.stoppedReels.every(Boolean)) {
      this.isNearMiss = this.pendingNearMiss;
      this.finishTimeout = setTimeout(() => this.finish(this.pendingIsWin), 500);
    }
  }

  ngOnDestroy(): void {
    this.cycleIntervals.forEach(id => id && clearInterval(id));
    this.autoStopTimeouts.forEach(id => id && clearTimeout(id));
    if (this.finishTimeout) clearTimeout(this.finishTimeout);
    if (this.pullInterval) clearInterval(this.pullInterval);
  }

  private pickFinalSymbols(isWin: boolean, guaranteeNearMiss = false): { symbols: ReelSymbol[]; nearMiss: boolean } {
    if (isWin) {
      return { symbols: [this.STAG, this.STAG, this.STAG], nearMiss: false };
    }

    // Szándékos "majdnem" — 2 szarvas landol, a 3. dobon biztosan valami más
    if (guaranteeNearMiss || Math.random() < this.NEAR_MISS_CHANCE) {
      const missReelIndex = Math.floor(Math.random() * 3);
      const other = this.randomSymbol(this.STAG);
      const symbols: ReelSymbol[] = [this.STAG, this.STAG, this.STAG];
      symbols[missReelIndex] = other;
      return { symbols, nearMiss: true };
    }

    // Tiszta vesztes forgatás — véletlen szimbólumok, sose mind a 3 egyforma
    let symbols: ReelSymbol[];
    do {
      symbols = [this.randomSymbol(), this.randomSymbol(), this.randomSymbol()];
    } while (symbols.every(s => s.value === symbols[0].value));
    return { symbols, nearMiss: false };
  }

  private randomSymbol(exclude?: ReelSymbol): ReelSymbol {
    const pool = exclude ? this.SYMBOLS.filter(s => s.value !== exclude.value) : this.SYMBOLS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private finish(isWin: boolean): void {
    this.state = isWin ? 'won' : 'lost';
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

  retry(): void {
    this.state = 'idle';
    this.reels = [this.SYMBOLS[1], this.SYMBOLS[2], this.SYMBOLS[3]];
    this.stoppedReels = [false, false, false];
    this.isNearMiss = false;
    this.confetti = [];
    this.perfectPull = false;
    this.pullLocked = false;
  }
}
