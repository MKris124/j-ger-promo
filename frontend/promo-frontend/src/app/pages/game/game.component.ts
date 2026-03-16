import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { CatchTheJagerComponent } from './games/jager.component';
import { RideTheBusComponent } from './games/ride-the-bus.component';

interface PrizePocket {
  id: number;
  qrCodeHash: string;
  status: 'AVAILABLE' | 'REDEEMED';
  wonAt: string;
  redeemedAt: string | null;
  inventoryItem: { id: number; name: string; liquid: boolean } | null;
}

interface GameLog {
  id: number;
  gameName: string;
  winner: boolean;
  playedAt: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

type Tab = 'game' | 'profile';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, CatchTheJagerComponent, RideTheBusComponent, QRCodeComponent],
  templateUrl: './game.component.html',
})
export class GameComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private apiBase = 'http://localhost:8080/api/game';

  activeTab: Tab = 'game';

  // Active game
  activeGame: { id: number; name: string; frontendComponentName: string } | null = null;
  gameResult: 'won' | 'lost' | null = null;
  lastPrize: PrizePocket | null = null;

  // Profil adatok
  profile: UserProfile | null = null;
  pockets: PrizePocket[] = [];
  gameLogs: GameLog[] = [];
  profileLoading = true;

  // QR modal
  qrModalPocket: PrizePocket | null = null;

  private refreshInterval: any = null;

  ngOnInit(): void {
    this.loadProfile();
    this.loadActiveGame();
    // 30mp-enként automatikusan frissítjük a zsebeket
    this.refreshInterval = setInterval(() => {
      if (this.activeTab === 'profile') this.loadProfile();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadActiveGame(): void {
    this.http.get<any>('http://localhost:8080/api/game/active', { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.activeGame = data; },
      error: () => {}
    });
  }

  onGameWon(): void {
    const userId = parseInt(localStorage.getItem('userId') || '0', 10);
    const gameId = this.activeGame?.id;
    if (!gameId) return;

    this.http.post<PrizePocket>(
      'http://localhost:8080/api/game/play',
      { userId, gameId, winner: true },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (pocket) => {
        this.lastPrize = pocket;
        this.gameResult = 'won';
        this.loadProfile(); // frissítjük a zsebeket
      },
      error: (err) => {
        // Max 2 nyeremény vagy minden elfogyott
        this.gameResult = 'won'; // játék szempontjából nyert, de nincs új zseb
      }
    });
  }

  onGameLost(): void {
    const userId = parseInt(localStorage.getItem('userId') || '0', 10);
    const gameId = this.activeGame?.id;
    if (!gameId) return;

    this.http.post(
      'http://localhost:8080/api/game/play',
      { userId, gameId, winner: false },
      { headers: this.getHeaders() }
    ).subscribe({ next: () => {}, error: () => {} });

    this.gameResult = 'lost';
  }

  clearGameResult(): void {
    this.gameResult = null;
    this.lastPrize = null;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadProfile(): void {
    this.profileLoading = true;
    const userId = localStorage.getItem('userId');

    // Profil alap adatok localStorage-ból (token tartalmazza)
    this.profile = {
      id: parseInt(userId || '0'),
      name: localStorage.getItem('userName') || 'Játékos',
      email: '',
      createdAt: '',
    };

    // Nyeremény zsebek
    this.http.get<PrizePocket[]>(`${this.apiBase}/my-pockets?userId=${userId}`, { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.pockets = data;
        this.profileLoading = false;
      },
      error: () => { this.profileLoading = false; }
    });

    // Játék előzmények
    this.http.get<GameLog[]>(`${this.apiBase}/my-logs?userId=${userId}`, { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.gameLogs = data; },
      error: () => {}
    });
  }

  openQr(pocket: PrizePocket): void {
    this.qrModalPocket = pocket;
  }

  closeQr(): void {
    this.qrModalPocket = null;
    this.loadProfile(); // frissítjük a zsebeket — lehet hogy közben beváltotta a promoter
  }

  getPrizeIcon(pocket: PrizePocket): string {
    if (!pocket.inventoryItem) return '🥃';
    return pocket.inventoryItem.liquid ? '🍶' : '🎁';
  }

  getPrizeName(pocket: PrizePocket): string {
    return pocket.inventoryItem?.name ?? 'Jäger Shot';
  }

  getQrUrl(pocket: PrizePocket): string {
    // QR kód tartalom — csak a hash, a promoter app ezt küldi el a backendnek
    return pocket.qrCodeHash;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('hu-HU', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  isAllRedeemed(): boolean {
    return this.pockets.length >= 2 && this.pockets.every(p => p.status === 'REDEEMED');
  }

  getEmptySlots(): number[] {
    const filled = Math.min(this.pockets.length, 2);
    return Array(2 - filled).fill(0);
  }

  getAvailableCount(): number {
    return this.pockets.filter(p => p.status === 'AVAILABLE').length;
  }

  getWinCount(): number {
    return this.gameLogs.filter(l => l.winner).length;
  }

  logout(): void {
    this.authService.logout();
  }
}