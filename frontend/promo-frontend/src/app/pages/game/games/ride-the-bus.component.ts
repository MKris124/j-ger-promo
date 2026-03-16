import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Color = 'red' | 'black';

interface Card {
  value: number;
  suit: Suit;
  color: Color;
  label: string;
}

type RoundState = 'guess' | 'reveal' | 'won_round' | 'lost_round';
type GameState = 'idle' | 'playing' | 'champion' | 'busted' | 'kept_shot';

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

  gameState: GameState = 'idle';
  roundState: RoundState = 'guess';

  currentLevel = 0;
  currentCard: Card | null = null;
  previousCards: Card[] = [];

  // true csak az 1. szint megnyerése UTÁN, és csak addig amíg nem döntött
  hasShotPrize = false;

  readonly rounds: Round[] = [
    { level: 0, question: 'Piros vagy Fekete?',   options: ['♥ Piros', '♠ Fekete'] },
    { level: 1, question: 'Kisebb, Rajta vagy Nagyobb?', options: ['⬇ Kisebb', '= Rajta', '⬆ Nagyobb'] },
    { level: 2, question: 'Közötte vagy Kívül?',  options: ['↔ Közötte', '↕ Kívül'] },
    { level: 3, question: 'Melyik szín?',         options: ['♥ Kőr', '♦ Káró', '♣ Treff', '♠ Pikk'] },
  ];

  get currentRound(): Round { return this.rounds[this.currentLevel]; }

  private drawCard(): Card {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const suit = suits[Math.floor(Math.random() * 4)];
    const color: Color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
    const value = Math.floor(Math.random() * 13) + 2;
    const labels: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    return { value, suit, color, label: labels[value] || value.toString() };
  }

  startGame(): void {
    this.gameState = 'playing';
    this.roundState = 'guess';
    this.currentLevel = 0;
    this.previousCards = [];
    this.hasShotPrize = false;
    this.currentCard = null;
  }

  guess(option: number): void {
    if (this.roundState !== 'guess') return;
    this.currentCard = this.drawCard();
    this.roundState = 'reveal';

    setTimeout(() => {
      if (this.checkGuess(option)) {
        if (this.currentLevel === 0) this.hasShotPrize = true;
        this.roundState = 'won_round';
      } else {
        this.roundState = 'lost_round';
      }
    }, 1000);
  }

  private checkGuess(option: number): boolean {
    const card = this.currentCard!;
    const prev = this.previousCards;

    switch (this.currentLevel) {
      case 0:
        return (option === 0 && card.color === 'red') ||
               (option === 1 && card.color === 'black');
      case 1:
        // 0=Kisebb, 1=Rajta (egyenlő), 2=Nagyobb
        const ref = prev[prev.length - 1].value;
        if (card.value === ref) return option === 1;       // egyenlő → csak Rajta nyer
        if (card.value < ref)  return option === 0;        // kisebb → csak Kisebb nyer
        return option === 2;                               // nagyobb → csak Nagyobb nyer
      case 2:
        // Közötte: SZIGORÚAN a két lap KÖZÖTT (egyenlő esetén veszít)
        const lo = Math.min(prev[0].value, prev[1].value);
        const hi = Math.max(prev[0].value, prev[1].value);
        const between = card.value > lo && card.value < hi; // < és > nem <=/>= !
        return (option === 0 && between) || (option === 1 && !between);
      case 3:
        const suitMap: Record<number, Suit> = { 0: 'hearts', 1: 'diamonds', 2: 'clubs', 3: 'spades' };
        return card.suit === suitMap[option];
      default: return false;
    }
  }

  // Játékos kikéri a shotot az 1. szint után — NYERT, nem veszített
  keepShot(): void {
    this.gameState = 'kept_shot';
    this.gameWon.emit();
  }

  // Továbblép — shot elveszett véglegesen, nincs visszaút
  continueGame(): void {
    if (this.currentCard) this.previousCards.push(this.currentCard);
    this.currentCard = null;
    this.hasShotPrize = false; // döntött: továbblép, nincs több shot opció

    if (this.currentLevel === 3) {
      this.gameState = 'champion';
      this.gameWon.emit();
    } else {
      this.currentLevel++;
      this.roundState = 'guess';
    }
  }

  bust(): void {
    this.gameState = 'busted';
    this.gameLost.emit();
  }

  retry(): void { this.gameState = 'idle'; }

  getSuitSymbol(suit: Suit): string {
    return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit];
  }

  getCardColorClass(card: Card): string {
    return card.color === 'red' ? 'text-red-600' : 'text-gray-900';
  }
}