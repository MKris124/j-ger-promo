import { Component, OnInit, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';

type Suit = 'stag' | 'herb' | 'anise' | 'barrel';
type Color = 'orange' | 'green';

interface Card {
  value: number;   // 2-14 (14 = ász)
  suit: Suit;
  color: Color;
  label: string;   // '2'-'10', 'J', 'Q', 'K', 'A'
}

type RoundState = 'guess' | 'reveal' | 'won_round' | 'lost_round';
type GameState = 'idle' | 'playing' | 'champion' | 'busted';

interface Round {
  level: number;
  question: string;
  options: string[];
}

@Component({
  selector: 'app-ride-the-bus',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ride-the-bus.component.html',
})
export class RideTheBusComponent {

  @Output() gameWon = new EventEmitter<void>();
  @Output() gameLost = new EventEmitter<void>();

  private http = inject(HttpClient);

  gameState: GameState = 'idle';
  roundState: RoundState = 'guess';

  currentLevel = 0; // 0-3
  currentCard: Card | null = null;
  previousCards: Card[] = [];

  // A megnyert nyeremény az aktuális szinten (mindig van shot az 1. szinttől)
  hasShotPrize = false;
  finalPrize: string | null = null; // a főnyeremény neve

  readonly rounds: Round[] = [
    {
      level: 0,
      question: 'Piros vagy Fekete?',
      options: ['🟠 Narancs', '🟢 Zöld'],
    },
    {
      level: 1,
      question: 'Kisebb vagy Nagyobb?',
      options: ['⬇ Kisebb', '⬆ Nagyobb'],
    },
    {
      level: 2,
      question: 'Közötte vagy Kívül?',
      options: ['↔ Közötte', '↕ Kívül'],
    },
    {
      level: 3,
      question: 'Melyik szimbólum?',
      options: ['🦌 Szarvas', '🌿 Gyógynövény', '⭐ Csillagánizs', '🪣 Hordó'],
    },
  ];

  get currentRound(): Round {
    return this.rounds[this.currentLevel];
  }

  get isLastLevel(): boolean {
    return this.currentLevel === 3;
  }

  // --- Lap generálás ---
  private drawCard(): Card {
    const suits: Suit[] = ['stag', 'herb', 'anise', 'barrel'];
    const colors: Color[] = ['orange', 'green'];
    const value = Math.floor(Math.random() * 13) + 2;
    const labels: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    return {
      value,
      suit: suits[Math.floor(Math.random() * 4)],
      color: colors[Math.floor(Math.random() * 2)],
      label: labels[value] || value.toString(),
    };
  }

  startGame(): void {
    this.gameState = 'playing';
    this.roundState = 'guess';
    this.currentLevel = 0;
    this.previousCards = [];
    this.hasShotPrize = false;
    this.currentCard = null;
    this.finalPrize = null;
  }

  guess(option: number): void {
    if (this.roundState !== 'guess') return;
    this.currentCard = this.drawCard();
    const correct = this.checkGuess(option);
    this.roundState = 'reveal';

    setTimeout(() => {
      if (correct) {
        if (this.currentLevel === 0) this.hasShotPrize = true;
        this.roundState = 'won_round';
      } else {
        this.roundState = 'lost_round';
      }
    }, 1200);
  }

  private checkGuess(option: number): boolean {
    const card = this.currentCard!;
    const prev = this.previousCards;

    switch (this.currentLevel) {
      case 0: // Narancs(0) vagy Zöld(1)
        return (option === 0 && card.color === 'orange') ||
               (option === 1 && card.color === 'green');

      case 1: // Kisebb(0) vagy Nagyobb(1)
        const ref = prev[prev.length - 1].value;
        return (option === 0 && card.value < ref) ||
               (option === 1 && card.value > ref) ||
               card.value === ref; // döntetlen = nyerés

      case 2: // Közötte(0) vagy Kívül(1)
        const lo = Math.min(prev[0].value, prev[1].value);
        const hi = Math.max(prev[0].value, prev[1].value);
        const between = card.value > lo && card.value < hi;
        return (option === 0 && between) || (option === 1 && !between);

      case 3: // Szimbólum
        const suitMap: Record<number, Suit> = { 0: 'stag', 1: 'herb', 2: 'anise', 3: 'barrel' };
        return card.suit === suitMap[option];

      default: return false;
    }
  }

  keepShot(): void {
    // Játékos kiveszi a shotot és nem kockáztat tovább
    this.gameState = 'busted'; // nem igazi bust, csak befejezi shot-tal
    this.gameLost.emit(); // frontend szempontból "nem nyert főnyereményt"
  }

  continueGame(): void {
    if (this.currentCard) this.previousCards.push(this.currentCard);
    this.currentCard = null;

    if (this.currentLevel === 3) {
      // Főnyeremény!
      this.gameState = 'champion';
      this.gameWon.emit();
    } else {
      this.currentLevel++;
      this.roundState = 'guess';
    }
  }

  bust(): void {
    // Elveszítette a shotot is
    this.hasShotPrize = false;
    this.gameState = 'busted';
    this.gameLost.emit();
  }

  retry(): void {
    this.gameState = 'idle';
  }

  getSuitIcon(suit: Suit): string {
    const icons: Record<Suit, string> = {
      stag: '🦌', herb: '🌿', anise: '⭐', barrel: '🪣'
    };
    return icons[suit];
  }

  getColorClass(color: Color): string {
    return color === 'orange' ? 'border-jager-orange text-jager-orange' : 'border-green-400 text-green-400';
  }

  getColorBg(color: Color): string {
    return color === 'orange' ? 'bg-jager-orange/10' : 'bg-green-400/10';
  }
}