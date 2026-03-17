import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { CatchTheJagerComponent } from './games/jager.component';
import { RideTheBusComponent } from './games/ride-the-bus.component';
import { environment } from '../../../environments/environments';

interface PrizePocket {
  id: number;
  qrCodeHash: string;
  status: 'AVAILABLE' | 'REDEEMED';
  wonAt: string;
  redeemedAt: string | null;
  inventoryItem: { id: number; name: string; liquid: boolean } | null;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, CatchTheJagerComponent, RideTheBusComponent, PageHeaderComponent],
  templateUrl: './game.component.html',
})
export class GameComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private apiBase = `${environment.apiUrl}/api/game`;

  activeGame: { id: number; name: string; gameKey: string } | null = null;
  gameResult: 'won' | 'lost' | null = null;
  lastPrize: PrizePocket | null = null;
  availableCount = 0;

  private refreshInterval: any = null;

  ngOnInit(): void {
    this.loadActiveGame();
    this.loadAvailableCount();
    this.refreshInterval = setInterval(() => this.loadAvailableCount(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadActiveGame(): void {
    this.http.get<any>(`${environment.apiUrl}/api/game/active`, { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.activeGame = data; },
      error: () => {}
    });
  }

  loadAvailableCount(): void {
    const userId = localStorage.getItem('userId');
    this.http.get<PrizePocket[]>(`${this.apiBase}/my-pockets?userId=${userId}`, { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.availableCount = data.filter(p => p.status === 'AVAILABLE').length; },
      error: () => {}
    });
  }

  onGameWon(): void {
    const userId = parseInt(localStorage.getItem('userId') || '0', 10);
    const gameId = this.activeGame?.id;
    if (!gameId) return;

    this.http.post<PrizePocket>(
      `${this.apiBase}/play`,
      { userId, gameId, winner: true },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (pocket) => {
        this.lastPrize = pocket;
        this.gameResult = 'won';
        this.loadAvailableCount();
      },
      error: () => { this.gameResult = 'won'; }
    });
  }

  onGameLost(): void {
    const userId = parseInt(localStorage.getItem('userId') || '0', 10);
    const gameId = this.activeGame?.id;
    if (!gameId) return;
    this.http.post(`${this.apiBase}/play`, { userId, gameId, winner: false }, { headers: this.getHeaders() })
      .subscribe({ next: () => {}, error: () => {} });
    this.gameResult = 'lost';
  }

  clearGameResult(): void {
    this.gameResult = null;
    this.lastPrize = null;
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  getPrizeIcon(pocket: PrizePocket): string {
    if (!pocket.inventoryItem) return '🥃';
    return pocket.inventoryItem.liquid ? '🍶' : '🎁';
  }

  getPrizeName(pocket: PrizePocket): string {
    return pocket.inventoryItem?.name ?? 'Jäger Shot';
  }

  logout(): void { this.authService.logout(); }
}