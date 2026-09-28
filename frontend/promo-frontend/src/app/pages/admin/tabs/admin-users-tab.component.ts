import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type SortColumn = 'id' | 'name' | 'email' | 'provider' | 'role';

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-tab.component.html'
})
export class AdminUsersTabComponent implements OnChanges {
  // Adatok fogadása a szülőtől
  @Input() users: any[] = [];
  @Input() filteredUsers: any[] = [];
  @Input() userSearchTerm: string = '';
  @Input() roleOptions: string[] = [];

  // Események küldése a szülőnek
  @Output() searchTermChange = new EventEmitter<string>();
  @Output() changeRole = new EventEmitter<{ user: any, role: string }>();
  @Output() deleteUser = new EventEmitter<any>();

  // Rendezés + lapozás — kliens oldalon, hogy 700+ user se lassítsa/terhelje az oldalt egyszerre
  sortColumn: SortColumn = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage = 1;
  readonly pageSize = 25;

  ngOnChanges(changes: SimpleChanges): void {
    // Ha a keresés (vagy maga a userlista) változik, ugorjunk vissza az 1. oldalra —
    // különben könnyen egy üres oldalon ragadhat a felhasználó
    if (changes['filteredUsers']) {
      this.currentPage = 1;
    }
  }

  get sortedUsers(): any[] {
    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    return [...this.filteredUsers].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA == null && valB == null) return 0;
      if (valA == null) return -1 * dir;
      if (valB == null) return 1 * dir;
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedUsers.length / this.pageSize));
  }

  get pagedUsers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedUsers.slice(start, start + this.pageSize);
  }

  get rangeStart(): number {
    return this.filteredUsers.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  setSort(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
  }

  sortIcon(column: SortColumn): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? '▲' : '▼';
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
}
