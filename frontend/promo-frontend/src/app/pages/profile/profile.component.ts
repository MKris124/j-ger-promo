import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { PageHeaderComponent } from '../../shared/page-header.component';

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
  prizeName: string | null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, QRCodeComponent, PageHeaderComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private apiBase = 'http://localhost:8080/api/game';

  userName = localStorage.getItem('userName') || 'Játékos';
  pockets: PrizePocket[] = [];
  gameLogs: GameLog[] = [];
  loading = true;
  qrModalPocket: PrizePocket | null = null;

  private refreshInterval: any = null;

  ngOnInit(): void {
    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadData(): void {
    const userId = localStorage.getItem('userId');
    this.http.get<PrizePocket[]>(`${this.apiBase}/my-pockets?userId=${userId}`, { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.pockets = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
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
    this.loadData();
  }

  getPrizeIcon(pocket: PrizePocket): string {
    if (!pocket.inventoryItem) return '🥃';
    return pocket.inventoryItem.liquid ? '🍶' : '🎁';
  }

  getPrizeName(pocket: PrizePocket): string {
    return pocket.inventoryItem?.name ?? 'Jäger Shot';
  }

  getStockPercent(stock: number): number {
    return Math.min((stock / 200) * 100, 100);
  }

  getEmptySlots(): number[] {
    const filled = Math.min(this.pockets.length, 2);
    return Array(2 - filled).fill(0);
  }

  isAllRedeemed(): boolean {
    return this.pockets.length >= 2 && this.pockets.every(p => p.status === 'REDEEMED');
  }

  getAvailableCount(): number {
    return this.pockets.filter(p => p.status === 'AVAILABLE').length;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('hu-HU', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getWinCount(): number {
    return this.gameLogs.filter(l => l.winner).length;
  }

  logout(): void { this.authService.logout(); }
}