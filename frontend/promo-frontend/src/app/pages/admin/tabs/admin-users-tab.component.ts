import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-tab.component.html'
})
export class AdminUsersTabComponent {
  // Adatok fogadása a szülőtől
  @Input() users: any[] = [];
  @Input() filteredUsers: any[] = [];
  @Input() userSearchTerm: string = '';
  @Input() roleOptions: string[] = [];

  // Események küldése a szülőnek
  @Output() searchTermChange = new EventEmitter<string>();
  @Output() changeRole = new EventEmitter<{ user: any, role: string }>();
}