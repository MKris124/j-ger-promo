import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  private router = inject(Router);
  lastUpdated = '2025. január 1.';

  goBack(): void {
    this.router.navigate(['/']);
  }
}