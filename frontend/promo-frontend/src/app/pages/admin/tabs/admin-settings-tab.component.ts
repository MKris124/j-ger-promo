import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-settings-tab.component.html'
})
export class AdminSettingsTabComponent {
  // Beérkező adatok a szülőtől
  @Input() settings: any = {}; // Javasolt típus: AppSettings
  @Input() games: any[] = []; // Javasolt típus: Game[]
  @Input() loading: boolean = false;
  
  // Űrlap állapotok (kétirányú adatkötéshez)
  @Input() shotsPerLiterInput: number = 0;
  @Input() scheduleMode: 'manual' | 'scheduled' = 'manual';
  @Input() eventStartInput: string = '';
  @Input() eventEndInput: string = '';

  // Események (változások) küldése a szülőnek
  @Output() shotsPerLiterInputChange = new EventEmitter<number>();
  @Output() scheduleModeChange = new EventEmitter<'manual' | 'scheduled'>();
  @Output() eventStartInputChange = new EventEmitter<string>();
  @Output() eventEndInputChange = new EventEmitter<string>();
  
  // Gombnyomások (Action-ök)
  @Output() toggleEvent = new EventEmitter<void>();
  @Output() updateSettings = new EventEmitter<void>();
  @Output() setActiveGame = new EventEmitter<any>();

  // Segédmetódus a HTML-ben használt példákhoz (az eredeti kódból átemelve)
  getLiterExamples() {
    if (!this.shotsPerLiterInput) return [];
    return [
      { label: '0.5L', shots: Math.floor(0.5 * this.shotsPerLiterInput) },
      { label: '0.7L', shots: Math.floor(0.7 * this.shotsPerLiterInput) },
      { label: '1.0L', shots: this.shotsPerLiterInput }
    ];
  }

  // Segédmetódus az időzítés státuszának kiírásához
  getEventTimeStatus(): string {
    if (!this.eventStartInput) return 'Nincs megadva kezdés.';
    const now = new Date().getTime();
    const start = new Date(this.eventStartInput).getTime();
    const end = this.eventEndInput ? new Date(this.eventEndInput).getTime() : null;

    if (now < start) return '⏳ Az esemény még nem kezdődött el (várakozás).';
    if (end && now > end) return '🛑 Az esemény már véget ért.';
    return '▶️ Az esemény a megadott időszak alapján jelenleg aktív.';
  }
}