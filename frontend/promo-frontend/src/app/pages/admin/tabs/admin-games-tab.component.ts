import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-games-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-games-tab.component.html'
})
export class AdminGamesTabComponent {
  // Bemenő adatok
  @Input() registeredGames: any[] = []; // Javasolt típus: RegisteredGame[]
  @Input() games: any[] = []; // Javasolt típus: Game[]
  @Input() settings: any = {}; // Javasolt típus: AppSettings
  @Input() loading: boolean = false;

  // Események
  @Output() addGameFromRegistry = new EventEmitter<any>();
  @Output() deleteGame = new EventEmitter<any>();
  @Output() setActiveGameByKey = new EventEmitter<string>();

  // Segédmetódus a HTML számára (megkeresi a DB-ből betöltött játékok közt a kulcsot)
  getGameByKey(key: string): any | undefined {
    return this.games.find(g => g.gameKey === key);
  }
}