import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-feedbacks-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-feedbacks-tab.component.html'
})
export class AdminFeedbacksTabComponent {
  // Bemenő adatok
  @Input() feedbacks: any[] = []; // Javasolt típus: FeedbackResponse[]
}