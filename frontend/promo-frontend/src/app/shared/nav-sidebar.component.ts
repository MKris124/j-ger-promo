import { Component, inject, OnInit, OnDestroy, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-nav-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-sidebar.component.html',
})
export class NavSidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
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
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.enableScroll();
  }

  private checkEventStatus(): void {
    if (this.role === 'ADMIN' || this.role === 'PROMOTER') return;
    this.http.get<{ eventActive: boolean }>('http://localhost:8080/api/auth/event-status').subscribe({
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

  setSubTab(key: string): void {
    this.activeSubTab = key;
    this.tabChanged.emit(key);
    window.dispatchEvent(new CustomEvent('adminTabChange', { detail: key }));
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
    ];
    return items
      .filter(item => item.roles.includes(this.role))
      .map(item => ({
        ...item,
        isActive: this.router.url.startsWith(item.path)
      }));
  }

  get navItems() {
    return this.allNavItems.filter(i => !i.isActive);
  }

  get currentPath(): string { return this.router.url; }
}