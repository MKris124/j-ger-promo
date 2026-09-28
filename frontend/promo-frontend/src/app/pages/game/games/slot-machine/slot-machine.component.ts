import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ReelSymbol {
  type: 'image' | 'emoji';
  value: string;
}

type GameState = 'idle' | 'spinning' | 'won' | 'lost';

@Component({
  selector: 'app-slot-machine',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slot-machine.component.html',
})
export class SlotMachineComponent implements OnDestroy {
  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  // Ha a komponens elpusztul pörgés közben (pl. elnavigál), ezeket törölni kell —
  // különben a timerek egy már eltűnt komponensen futnának tovább a háttérben
  private cycleIntervals: ReturnType<typeof setInterval>[] = [];
  private stopTimeouts: ReturnType<typeof setTimeout>[] = [];

  // A nyerés esélye NEM a reel-szimbólumok véletlenszerű egyezéséből jön —
  // előre eldől, a reel-ek csak ezt "játsszák le" vizuálisan (garantáltan
  // pontos, kontrollálható esély, klasszikus promó-gép trükk).
  private readonly WIN_CHANCE = 0.18;

  private readonly STAG: ReelSymbol = { type: 'image', value: '/assets/stag.png' };
  private readonly SYMBOLS: ReelSymbol[] = [
    this.STAG,
    { type: 'emoji', value: '🍒' },
    { type: 'emoji', value: '🍋' },
    { type: 'emoji', value: '7️⃣' },
    { type: 'emoji', value: '💎' },
    { type: 'emoji', value: '🍀' },
  ];

  state: GameState = 'idle';
  reels: ReelSymbol[] = [this.SYMBOLS[1], this.SYMBOLS[2], this.SYMBOLS[3]];
  spinningReels = [false, false, false];

  spin(): void {
    if (this.state === 'spinning') return;
    this.state = 'spinning';
    this.spinningReels = [true, true, true];

    const isWin = Math.random() < this.WIN_CHANCE;
    const finalSymbols = this.pickFinalSymbols(isWin);
    const stopDelays = [900, 1500, 2200];

    // Amíg egy dob "pörög", véletlenszerűen váltogatjuk a szimbólumát —
    // ez adja a tényleges pörgés-érzetet, nem csak egy statikus CSS blur
    this.cycleIntervals = [];
    for (let i = 0; i < 3; i++) {
      this.cycleIntervals[i] = setInterval(() => {
        this.reels[i] = this.randomSymbol();
      }, 80);
    }

    this.stopTimeouts = [];
    finalSymbols.forEach((symbol, i) => {
      this.stopTimeouts[i] = setTimeout(() => {
        clearInterval(this.cycleIntervals[i]);
        this.reels[i] = symbol;
        this.spinningReels[i] = false;

        if (i === finalSymbols.length - 1) {
          this.stopTimeouts.push(setTimeout(() => this.finish(isWin), 500));
        }
      }, stopDelays[i]);
    });
  }

  ngOnDestroy(): void {
    this.cycleIntervals.forEach(clearInterval);
    this.stopTimeouts.forEach(clearTimeout);
  }

  private pickFinalSymbols(isWin: boolean): ReelSymbol[] {
    if (isWin) {
      return [this.STAG, this.STAG, this.STAG];
    }

    // Vesztes forgatás — véletlen szimbólumok, de sose lehet mind a 3 egyforma
    let symbols: ReelSymbol[];
    do {
      symbols = [this.randomSymbol(), this.randomSymbol(), this.randomSymbol()];
    } while (symbols.every(s => s.value === symbols[0].value));
    return symbols;
  }

  private randomSymbol(): ReelSymbol {
    return this.SYMBOLS[Math.floor(Math.random() * this.SYMBOLS.length)];
  }

  private finish(isWin: boolean): void {
    this.state = isWin ? 'won' : 'lost';
    if (isWin) {
      this.gameWon.emit();
    } else {
      this.gameLost.emit();
    }
  }

  retry(): void {
    this.state = 'idle';
    this.reels = [this.SYMBOLS[1], this.SYMBOLS[2], this.SYMBOLS[3]];
  }
}
