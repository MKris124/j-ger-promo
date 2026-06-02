import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { GAME_REGISTRY, RegisteredGame } from '../../shared/game-registry';
import { environment } from '../../../environments/environments';


import { AdminSettingsTabComponent } from './tabs/admin-settings-tab.component';
import { AdminUsersTabComponent } from './tabs/admin-users-tab.component';
import { AdminGamesTabComponent } from './tabs/admin-games-tab.component';
import { AdminInventoryTabComponent } from './tabs/admin-inventory-tab.component';
import { AdminFeedbacksTabComponent } from './tabs/admin-feedbacks-tab.component';

interface Game {
  id: number;
  name: string;
  gameKey: string;
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
  key: 'settings' | 'inventory' | 'users' | 'games' | 'feedbacks'; 
  label: string;
  shortLabel: string;
  icon: string;
}

interface FeedbackResponse {
  id: number;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, 
    FormsModule, 
    PageHeaderComponent, 
    AdminSettingsTabComponent, 
    AdminGamesTabComponent, 
    AdminInventoryTabComponent, 
    AdminUsersTabComponent, 
    AdminFeedbacksTabComponent],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private apiBase = `${environment.apiUrl}/api/admin`;

  feedbacks: FeedbackResponse[] = [];

  tabs: Tab[] = [
    { key: 'settings',  label: 'Beállítások', shortLabel: 'Beáll.',  icon: '⚙️' },
    { key: 'games',     label: 'Játékok',      shortLabel: 'Játék',   icon: '🎮' },
    { key: 'inventory', label: 'Készlet',      shortLabel: 'Készlet', icon: '📦' },
    { key: 'users',     label: 'Felhasználók', shortLabel: 'Userek',  icon: '👥' },
    { key: 'feedbacks', label: 'Értékelések',  shortLabel: 'Vélem.',  icon: '⭐' }, 
  ];
  activeTab: 'settings' | 'inventory' | 'users' | 'games' | 'feedbacks' = 'settings'; 

  loading = false;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  settings: AppSettings = { id: 1, eventActive: false, shotsPerLiter: 0, activeGame: null, eventStart: null, eventEnd: null, drawMode: 'TIMED' };
  shotsPerLiterInput = 0;
  
  get scheduleMode(): 'manual' | 'scheduled' { return this._scheduleMode; }
  set scheduleMode(val: 'manual' | 'scheduled') {
    this._scheduleMode = val;
    if (val === 'manual' && this.settings.drawMode === 'TIMED') {
      this.settings.drawMode = 'PERCENTAGE';
    }
  }
  private _scheduleMode: 'manual' | 'scheduled' = 'manual';
  eventStartInput = ''; 
  eventEndInput = '';

  games: Game[] = [];
  newGameName = '';
  newGameComponent = '';
  newGameDesc = '';

  editingComponentGameId: number | null = null;
  editingComponentValue = '';
  inventoryItems: InventoryItem[] = [];
  newMerchName = '';
  newMerchIsLiquid = false;
  addStockMap: { [key: number]: number } = {};

  users: AppUser[] = [];
  roleOptions = ['USER', 'PROMOTER', 'ADMIN'];
  
  // --- ÚJ: Felhasználó Keresőmező ---
  userSearchTerm: string = '';

  ngOnInit(): void {
    this.loadSettings();
    this.loadGames();
    this.loadInventory();
    this.loadUsers();
    this.loadFeedbacks(); // ÚJ: Betöltjük a visszajelzéseket induláskor!

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'] as any;
      }
    });

    window.addEventListener('adminTabChange', (e: any) => {
      this.activeTab = e.detail;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: this.activeTab },
        queryParamsHandling: 'merge'
      });
    });
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
      body.eventStart = this.eventStartInput + ':00';
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

  // --- ÚJ: Visszajelzések Lekérése ---
  loadFeedbacks() {
    this.http.get<FeedbackResponse[]>(`${this.apiBase}/feedbacks`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => this.feedbacks = data,
        error: (err) => console.error('Hiba a visszajelzések betöltésekor', err)
      });
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

  getGameByKey(key: string): Game | undefined {
    return this.games.find(g => g.gameKey === key);
  }

  addGameFromRegistry(reg: RegisteredGame): void {
    this.loading = true;
    const body = { name: reg.name, gameKey: reg.id, description: reg.description };
    this.http.post<Game>(`${this.apiBase}/games`, body, { headers: this.getHeaders() }).subscribe({
      next: (game) => {
        this.games.push(game);
        this.loading = false;
        this.showToast(`"${game.name}" hozzáadva!`, 'success');
      },
      error: () => { this.loading = false; this.showToast('Hozzáadás sikertelen', 'error'); }
    });
  }

  setActiveGameByKey(key: string): void {
    const game = this.getGameByKey(key);
    if (game) this.setActiveGame(game);
  }

  deleteGame(game: Game): void {
    if (!confirm(`Biztosan törlöd: "${game.name}"?`)) return;
    this.http.delete(`${this.apiBase}/games/${game.id}`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.games = this.games.filter(g => g.id !== game.id);
        if (this.settings.activeGame?.id === game.id) {
          this.settings.activeGame = null;
        }
        this.showToast(`"${game.name}" törölve`, 'success');
      },
      error: () => this.showToast('Törlés sikertelen', 'error')
    });
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
    if (qty == null || qty <= 0) return;
    this.http.post<InventoryItem>(`${this.apiBase}/inventory/${item.id}/add`, { addedQuantity: qty }, { headers: this.getHeaders() })
      .subscribe({
        next: (updated) => {
          const idx = this.inventoryItems.findIndex((i) => i.id === updated.id);
          if (idx !== -1) this.inventoryItems[idx] = updated;
          this.addStockMap[item.id] = null as any;
          this.showToast(`Készlet hozzáadva: ${updated.stock} db`, 'success');
        },
        error: () => this.showToast('Készlet feltöltés sikertelen', 'error')
      });
  }

  setQuickStock(item: InventoryItem, value: number): void {
    this.addStockMap[item.id] = value;
  }

  // --- ÚJ: Készlet levonása manuálisan ---
  subtractStock(item: InventoryItem): void {
    const qty = this.addStockMap[item.id];
    if (qty == null || qty <= 0) return;
    
    // A Backend a negatív számot levonásként értelmezi!
    this.http.post<InventoryItem>(`${this.apiBase}/inventory/${item.id}/add`, { addedQuantity: -qty }, { headers: this.getHeaders() })
      .subscribe({
        next: (updated) => {
          const idx = this.inventoryItems.findIndex((i) => i.id === updated.id);
          if (idx !== -1) this.inventoryItems[idx] = updated;
          this.addStockMap[item.id] = null as any;
          this.showToast(`Készlet levonva. Új mennyiség: ${updated.stock} db`, 'success');
        },
        error: () => this.showToast('Készlet levonás sikertelen', 'error')
      });
  }

  deleteItem(item: InventoryItem): void {
    if (!confirm(`Biztosan archiválod az elemet: "${item.name}"? Az új eseményeken már nem fog megjelenni.`)) return;
    this.http.delete(`${this.apiBase}/inventory/${item.id}`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.inventoryItems = this.inventoryItems.filter((i) => i.id !== item.id);
        this.showToast(`"${item.name}" archiválva`, 'success');
      },
      error: () => this.showToast('Archiválás sikertelen', 'error')
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

  // --- ÚJ: Kereső Getter ---
  get filteredUsers() {
    if (!this.userSearchTerm) return this.users;
    const term = this.userSearchTerm.toLowerCase();
    return this.users.filter(u => 
      (u.name && u.name.toLowerCase().includes(term)) || 
      (u.email && u.email.toLowerCase().includes(term))
    );
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
  registeredGames: RegisteredGame[] = GAME_REGISTRY;

  getActiveTabLabel(): string {
    return this.tabs.find(t => t.key === this.activeTab)?.label || '';
  }

  logout(): void { this.authService.logout(); }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    setTimeout(() => (this.toast = null), 3000);
  }
}