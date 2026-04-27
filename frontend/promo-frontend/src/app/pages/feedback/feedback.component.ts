import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-jager-dark text-jager-light flex flex-col p-4 md:p-6 pb-20">
      
      <button (click)="goBack()" class="self-start text-gray-500 hover:text-jager-orange mb-6 transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        Vissza
      </button>

      <div class="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        
        @if (!isSuccess) {
          <div class="w-full animate-[ptrPulse_0.3s_ease-out]">
            <div class="text-center mb-8">
              <h1 class="text-3xl md:text-4xl font-['Oswald'] font-black tracking-widest uppercase text-jager-orange mb-2 drop-shadow-md">Értékelj minket!</h1>
              <p class="text-sm text-gray-400 font-medium">Milyen volt a Jägermeister promóció? Oszd meg velünk a véleményed!</p>
            </div>

            <div class="jager-card p-6 md:p-8 flex flex-col items-center gap-6">
              
              <div class="flex gap-2 justify-center" (mouseleave)="hoverRating = 0">
                @for (star of [1, 2, 3, 4, 5]; track star) {
                  <button 
                    type="button"
                    (click)="setRating(star)"
                    (mouseenter)="hoverRating = star"
                    class="text-4xl md:text-5xl transition-all duration-200 transform-gpu active:scale-75 focus:outline-none"
                    [ngClass]="(hoverRating ? star <= hoverRating : star <= rating) ? 'text-jager-orange drop-shadow-[0_0_10px_rgba(243,112,33,0.6)] scale-110' : 'text-gray-600 hover:text-gray-500'"
                  >
                    ★
                  </button>
                }
              </div>
              <p class="text-[10px] uppercase tracking-[0.2em] font-bold h-4" [ngClass]="rating > 0 || hoverRating > 0 ? 'text-jager-amber' : 'text-transparent'">
                {{ getRatingText() }}
              </p>

              <div class="w-full mt-2">
                <textarea 
                  [(ngModel)]="comment"
                  placeholder="Opcionális: Írd meg, mit szerettél vagy miben fejlődhetnénk..."
                  class="w-full h-32 px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm text-jager-light placeholder-gray-600 focus:outline-none focus:border-jager-amber focus:ring-1 focus:ring-jager-amber transition-colors resize-none"
                ></textarea>
              </div>

              <button 
                (click)="submitFeedback()"
                [disabled]="rating === 0 || isSubmitting"
                class="w-full py-4 bg-jager-orange hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-jager-orange text-black font-black text-sm rounded-xl transition-all tracking-widest uppercase shadow-[0_0_15px_rgba(243,112,33,0.3)] active:scale-95 transform-gpu flex items-center justify-center gap-2"
              >
                @if (isSubmitting) {
                  <svg class="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke-linecap="round"></path></svg>
                  KÜLDÉS...
                } @else {
                  VÉLEMÉNY KÜLDÉSE
                }
              </button>
            </div>
          </div>
        } 
        
        @else {
          <div class="w-full jager-card p-8 text-center flex flex-col items-center gap-5 animate-[ptrPulse_0.3s_ease-out]">
            <div class="w-20 h-20 rounded-full bg-jager-orange/10 border-2 border-jager-orange/50 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(243,112,33,0.3)]">
              🧡
            </div>
            <div>
              <h2 class="text-3xl font-['Oswald'] font-black text-jager-light tracking-widest uppercase drop-shadow-md">Köszönjük!</h2>
              <p class="text-gray-400 text-sm mt-3 leading-relaxed">A visszajelzésedet rögzítettük. Sokat segít nekünk abban, hogy a következő buli még jobb legyen!</p>
            </div>
            <button 
              (click)="goBack()"
              class="mt-4 px-8 py-3 bg-transparent border border-white/10 hover:bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors"
            >
              ← Vissza a játékhoz
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class FeedbackComponent {
  private http = inject(HttpClient);
  
  rating = 0;
  hoverRating = 0;
  comment = '';
  
  isSubmitting = false;
  isSuccess = false;

  setRating(val: number) {
    this.rating = val;
  }

  getRatingText(): string {
    const val = this.hoverRating > 0 ? this.hoverRating : this.rating;
    switch(val) {
      case 1: return 'Nagyon gyenge';
      case 2: return 'Gyenge';
      case 3: return 'Átlagos';
      case 4: return 'Jó volt';
      case 5: return 'Eszméletlen jó!';
      default: return 'Válassz csillagot!';
    }
  }

  submitFeedback() {
    if (this.rating === 0 || this.isSubmitting) return;
    
    this.isSubmitting = true;
    
    // Az authInterceptor automatikusan ráteszi a tokent, így itt nem kell
    this.http.post(`${environment.apiUrl}/api/feedback`, { 
      rating: this.rating, 
      comment: this.comment 
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isSuccess = true;
      },
      error: (err) => {
        console.error('Hiba a küldésnél:', err);
        this.isSubmitting = false;
        alert('Hiba történt a küldés során, kérlek próbáld újra!');
      }
    });
  }

  goBack() {
    window.history.back();
  }
}