import { Component, inject, OnInit, OnDestroy, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router'; // <-- ActivatedRoute hozzáadva
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environments';

@Component({
  selector: 'app-nav-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-sidebar.component.html',
})
export class NavSidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // <-- Route injektálása az URL frissítéshez
  private http = inject(HttpClient);

  @Output() profileClicked = new EventEmitter<void>();
  @Output() tabChanged = new EventEmitter<string>();

  isOpen = false;
  role = localStorage.getItem('role') || 'USER';
  userName = localStorage.getItem('userName') || 'Játékos';
  activeSubTab = 'settings';

  adminTabs = [
    { key: 'settings',  label: 'Beállítások', icon: '⚙️' },
    { key: 'games',     label: 'Játékok',     icon: '🎮' },
    { key: 'inventory', label: 'Készlet',     icon: '📦' },
    { key: 'users',     label: 'Felhasználók',icon: '👥' },
  ];

  private pollInterval: any = null;
  private sidebarClicked = false;

  // Document-szintű click figyelő — ha a kattintás NEM a sidebaron belül volt, bezárjuk
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (this.sidebarClicked) {
      this.sidebarClicked = false;
      return;
    }
    this.close();
  }

  ngOnInit(): void {
    this.pollInterval = setInterval(() => this.checkEventStatus(), 30000);
    window.addEventListener('adminTabChange', (e: any) => {
      this.activeSubTab = e.detail;
    });

    // Ha az oldal betöltődik F5-tel, a sidebar is vegye fel a helyes aktív fület az URL-ből
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeSubTab = params['tab'];
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.enableScroll();
  }

  private checkEventStatus(): void {
    if (this.role === 'ADMIN' || this.role === 'PROMOTER') return;
    this.http.get<{ eventActive: boolean }>(`${environment.apiUrl}/api/auth/event-status`).subscribe({
      next: (res) => { if (!res.eventActive) this.authService.logout(); },
      error: () => {}
    });
  }

  private disableScroll(): void { document.body.style.overflow = 'hidden'; }
  private enableScroll(): void { document.body.style.overflow = ''; }

  open(): void { this.isOpen = true; this.disableScroll(); }
  close(): void { this.isOpen = false; this.enableScroll(); }

  toggle(): void {
    // A hamburger gombra kattintáskor jelöljük hogy sidebarban voltunk
    this.sidebarClicked = true;
    this.isOpen ? this.close() : this.open();
  }

  // Sidebar panelen belüli kattintásnál jelöljük — ne csukja be a document listener
  onSidebarClick(): void {
    this.sidebarClicked = true;
  }

  navigate(path: string): void {
    this.router.navigate([path]);
    this.close();
  }

  setSubTab(tabKey: string) {
    this.activeSubTab = tabKey;
    
    // 1. Frissítjük az URL query paraméterét
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKey },
      queryParamsHandling: 'merge' // Megtartja a többi paramétert
    });
    
    // 2. Szólunk az AdminComponent-nek (mivel az window eseményt figyel), hogy váltson fület
    window.dispatchEvent(new CustomEvent('adminTabChange', { detail: tabKey }));

    // 3. Ha mobilon vagyunk, zárjuk be a sidebart a kattintás után, hogy látszódjon is a tartalom
    this.close();
  }

  openProfile(): void {
    this.navigate('/profile');
  }

  logout(): void {
    this.close();
    this.authService.logout();
  }

  get isAdminPage(): boolean { return this.router.url.startsWith('/admin'); }

  get allNavItems() {
    const items = [
      { path: '/game',     label: 'Játék',         icon: '🎮', roles: ['USER', 'PROMOTER', 'ADMIN'] },
      { path: '/profile',  label: 'Profilom',       icon: '👤', roles: ['USER'] },
      { path: '/promoter', label: 'Promoter nézet', icon: '🔍', roles: ['PROMOTER', 'ADMIN'] },
      { path: '/admin',    label: 'Admin panel',    icon: '⚙️', roles: ['ADMIN'] },
      { path: '/faq', label: 'GYIK', icon: '❓', roles: ['USER', 'PROMOTER', 'ADMIN'] }
    ];
    return items
      .filter(item => item.roles.includes(this.role))
      .map(item => ({
        ...item,
        isActive: this.router.url.split('?')[0] === item.path // URL paraméterek (pl. ?tab=X) levágása az egyezéshez
      }));
  }

  get navItems() {
    return this.allNavItems.filter(i => !i.isActive);
  }

  get currentPath(): string { return this.router.url; }
}