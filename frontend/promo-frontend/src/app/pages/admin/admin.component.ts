import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface Game {
  id: number;
  name: string;
  frontendComponentName: string;
  description: string;
  active: boolean;
}

interface AppSettings {
  id: number;
  eventActive: boolean;
  shotsPerLiter: number;
  activeGame: Game | null;
  eventStart: string | null;
  eventEnd: string | null;
  drawMode: 'TIMED' | 'PERCENTAGE';
}

interface InventoryItem {
  id: number;
  name: string;
  liquid: boolean;
  stock: number;
  totalQuantity: number;
}

interface AppUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface Tab {
  key: 'settings' | 'inventory' | 'users' | 'games';
  label: string;
  shortLabel: string;
  icon: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private apiBase = 'http://localhost:8080/api/admin';

  tabs: Tab[] = [
    { key: 'settings',  label: 'Beállítások', shortLabel: 'Beáll.',  icon: '⚙️' },
    { key: 'games',     label: 'Játékok',      shortLabel: 'Játék',   icon: '🎮' },
    { key: 'inventory', label: 'Készlet',      shortLabel: 'Készlet', icon: '📦' },
    { key: 'users',     label: 'Felhasználók', shortLabel: 'Userek',  icon: '👥' },
  ];
  activeTab: 'settings' | 'inventory' | 'users' | 'games' = 'settings';

  loading = false;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  // --- Settings ---
  settings: AppSettings = { id: 1, eventActive: false, shotsPerLiter: 0, activeGame: null, eventStart: null, eventEnd: null, drawMode: 'TIMED' };
  shotsPerLiterInput = 0;
  // Időzítés mód: 'manual' vagy 'scheduled'
  scheduleMode: 'manual' | 'scheduled' = 'manual';
  eventStartInput = '';   // datetime-local input value: "2026-05-10T22:00"
  eventEndInput = '';

  // --- Games ---
  games: Game[] = [];
  newGameName = '';
  newGameComponent = '';
  newGameDesc = '';

  // --- Inventory ---
  inventoryItems: InventoryItem[] = [];
  newMerchName = '';
  newMerchIsLiquid = false;
  addStockMap: { [key: number]: number } = {};

  // --- Users ---
  users: AppUser[] = [];
  roleOptions = ['USER', 'PROMOTER', 'ADMIN'];

  ngOnInit(): void {
    this.loadSettings();
    this.loadGames();
    this.loadInventory();
    this.loadUsers();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // =================== SETTINGS ===================

  loadSettings(): void {
    this.http.get<AppSettings>(`${this.apiBase}/settings`, { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.settings = data;
        this.shotsPerLiterInput = data.shotsPerLiter;
        if (data.eventStart && data.eventEnd) {
          this.scheduleMode = 'scheduled';
          // Backend ISO-t datetime-local formátumra vágja (első 16 karakter: "2026-05-10T22:00")
          this.eventStartInput = data.eventStart.substring(0, 16);
          this.eventEndInput = data.eventEnd.substring(0, 16);
        } else {
          this.scheduleMode = 'manual';
        }
      },
      error: () => this.showToast('Beállítások betöltése sikertelen', 'error')
    });
  }

  updateSettings(): void {
    this.loading = true;
    const body: any = {
      eventActive: this.settings.eventActive,
      shotsPerLiter: this.shotsPerLiterInput,
      activeGameId: this.settings.activeGame?.id ?? null,
      drawMode: this.settings.drawMode,
    };

    if (this.scheduleMode === 'scheduled' && this.eventStartInput && this.eventEndInput) {
      body.eventStart = this.eventStartInput + ':00'; // LocalDateTime formátum
      body.eventEnd = this.eventEndInput + ':00';
    } else {
      body.eventStart = null;
      body.eventEnd = null;
    }

    this.http.post<AppSettings>(`${this.apiBase}/settings`, body, { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        this.settings = data;
        this.shotsPerLiterInput = data.shotsPerLiter;
        this.loading = false;
        this.showToast('Beállítások mentve!', 'success');
      },
      error: () => {
        this.loading = false;
        this.showToast('Mentés sikertelen', 'error');
      }
    });
  }

  toggleEvent(): void {
    this.settings.eventActive = !this.settings.eventActive;
    this.updateSettings();
  }

  getLiterExamples(): { label: string; shots: string }[] {
    const s = this.shotsPerLiterInput;
    return [
      { label: '0.5L', shots: (s * 0.5).toFixed(1) },
      { label: '1.0L', shots: s.toFixed(1) },
      { label: '1.75L', shots: (s * 1.75).toFixed(1) },
    ];
  }

  getEventTimeStatus(): string {
    if (this.scheduleMode !== 'scheduled' || !this.eventStartInput || !this.eventEndInput) return '';
    const now = new Date();
    const start = new Date(this.eventStartInput);
    const end = new Date(this.eventEndInput);
    if (now < start) return `⏳ Kezdés: ${start.toLocaleString('hu-HU')}`;
    if (now >= start && now <= end) return `🟢 Most aktív — vége: ${end.toLocaleString('hu-HU')}`;
    return `⛔ Véget ért: ${end.toLocaleString('hu-HU')}`;
  }

  // =================== GAMES ===================

  loadGames(): void {
    this.http.get<Game[]>(`${this.apiBase}/games`, { headers: this.getHeaders() }).subscribe({
      next: (data) => (this.games = data),
      error: () => {}
    });
  }

  createGame(): void {
    if (!this.newGameName.trim() || !this.newGameComponent.trim()) return;
    this.loading = true;
    const body = { name: this.newGameName, frontendComponentName: this.newGameComponent, description: this.newGameDesc };
    this.http.post<Game>(`${this.apiBase}/games`, body, { headers: this.getHeaders() }).subscribe({
      next: (game) => {
        this.games.push(game);
        this.newGameName = '';
        this.newGameComponent = '';
        this.newGameDesc = '';
        this.loading = false;
        this.showToast(`"${game.name}" játék létrehozva!`, 'success');
      },
      error: () => { this.loading = false; this.showToast('Létrehozás sikertelen', 'error'); }
    });
  }

  toggleGame(game: Game): void {
    this.http.post<Game>(`${this.apiBase}/games/${game.id}/toggle`, {}, { headers: this.getHeaders() }).subscribe({
      next: (updated) => {
        const idx = this.games.findIndex(g => g.id === updated.id);
        if (idx !== -1) this.games[idx] = updated;
        this.showToast(`"${updated.name}" ${updated.active ? 'bekapcsolva' : 'kikapcsolva'}`, 'success');
      },
      error: () => this.showToast('Hiba', 'error')
    });
  }

  setActiveGame(game: Game): void {
    this.settings.activeGame = game;
    this.updateSettings();
  }

  // =================== INVENTORY ===================

  loadInventory(): void {
    this.http.get<InventoryItem[]>(`${this.apiBase}/inventory`, { headers: this.getHeaders() }).subscribe({
      next: (data) => (this.inventoryItems = data),
      error: () => {}
    });
  }

  createMerch(): void {
    if (!this.newMerchName.trim()) return;
    this.loading = true;
    const body = { name: this.newMerchName, liquid: this.newMerchIsLiquid };
    this.http.post<InventoryItem>(`${this.apiBase}/inventory`, body, { headers: this.getHeaders() }).subscribe({
      next: (item) => {
        this.inventoryItems.push(item);
        this.newMerchName = '';
        this.newMerchIsLiquid = false;
        this.loading = false;
        this.showToast(`"${item.name}" létrehozva!`, 'success');
      },
      error: () => { this.loading = false; this.showToast('Létrehozás sikertelen', 'error'); }
    });
  }

  addStock(item: InventoryItem): void {
    const qty = this.addStockMap[item.id];
    if (qty == null) return;
    this.http.post<InventoryItem>(`${this.apiBase}/inventory/${item.id}/add`, { addedQuantity: qty }, { headers: this.getHeaders() })
      .subscribe({
        next: (updated) => {
          const idx = this.inventoryItems.findIndex((i) => i.id === updated.id);
          if (idx !== -1) this.inventoryItems[idx] = updated;
          this.addStockMap[item.id] = null as any;
          this.showToast(`Készlet frissítve: ${updated.stock} db`, 'success');
        },
        error: () => this.showToast('Készlet feltöltés sikertelen', 'error')
      });
  }

  deleteItem(item: InventoryItem): void {
    if (!confirm(`Biztosan törlöd: "${item.name}"?`)) return;
    this.http.delete(`${this.apiBase}/inventory/${item.id}`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.inventoryItems = this.inventoryItems.filter((i) => i.id !== item.id);
        this.showToast(`"${item.name}" törölve`, 'success');
      },
      error: () => this.showToast('Törlés sikertelen', 'error')
    });
  }

  getStockPercent(stock: number): number {
    return Math.min((stock / 200) * 100, 100);
  }

  // =================== USERS ===================

  loadUsers(): void {
    this.http.get<AppUser[]>(`${this.apiBase}/users`, { headers: this.getHeaders() }).subscribe({
      next: (data) => (this.users = data),
      error: () => {}
    });
  }

  changeRole(user: AppUser, newRole: string): void {
    this.http.post(`${this.apiBase}/users/${user.id}/role`, { role: newRole }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        user.role = newRole;
        this.showToast(`${user.name} szerepköre: ${newRole}`, 'success');
      },
      error: () => this.showToast('Szerepkör változtatás sikertelen', 'error')
    });
  }

  // =================== UTILS ===================

  logout(): void { this.authService.logout(); }
  goToGame(): void { this.router.navigate(['/game']); }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3000);
  }
}