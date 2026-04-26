import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/page-header.component'; // Változtasd meg az útvonalat, ha máshol van

interface FaqItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <div class="min-h-screen bg-jager-dark text-jager-light flex flex-col">
      
      <app-page-header title="JÄGER PROMO" currentTab="GYIK"></app-page-header>

      <div class="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full pb-12">
        
        <div class="mb-8 mt-4 text-center md:text-left">
          <h1 class="text-3xl md:text-4xl font-['Oswald'] font-black tracking-widest uppercase text-jager-orange mb-2 drop-shadow-md">Tudnivalók</h1>
          <p class="text-[11px] font-bold tracking-widest uppercase text-jager-amber opacity-80">Gyakran Ismételt Kérdések</p>
        </div>

        <div class="flex flex-col gap-3">
          @for (faq of faqs; track faq.question; let i = $index) {
            <div 
              class="jager-card border transition-colors duration-300 overflow-hidden cursor-pointer"
              [ngClass]="faq.isOpen ? 'border-jager-orange/50 bg-black/60' : 'border-jager-green-light/30 hover:border-jager-amber/40'"
              (click)="toggleFaq(i)"
            >
              <div class="p-4 flex items-center justify-between gap-4 select-none">
                <h3 class="text-sm font-bold text-white tracking-wide" [ngClass]="{'text-jager-orange': faq.isOpen}">
                  {{ faq.question }}
                </h3>
                
                <div class="w-6 h-6 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-300"
                     [ngClass]="faq.isOpen ? 'border-jager-orange text-jager-orange bg-jager-orange/10' : 'border-gray-500 text-gray-400'">
                  <svg class="w-4 h-4 transform transition-transform duration-300" 
                       [class.rotate-180]="faq.isOpen" 
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path *ngIf="!faq.isOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    <path *ngIf="faq.isOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                  </svg>
                </div>
              </div>

              <div 
                class="grid transition-all duration-300 ease-in-out"
                [ngClass]="faq.isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
              >
                <div class="overflow-hidden">
                  <div class="p-4 pt-0 text-sm text-gray-400 leading-relaxed border-t border-white/5 mt-1">
                    {{ faq.answer }}
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="mt-10 p-5 rounded-xl bg-jager-green-light/10 border border-jager-green-light/30 text-center">
          <p class="text-jager-amber text-xs font-bold tracking-widest uppercase mb-2">Nem találtad meg a választ?</p>
          <p class="text-sm text-gray-400 mb-4">A pultnál lévő Jägermeister promóterek szívesen segítenek neked!</p>
        </div>

      </div>
    </div>
  `
})
export class FaqComponent {
  faqs: FaqItem[] = [
    {
      question: 'Kik vehetnek részt a játékban?',
      answer: 'A promócióban kizárólag 18 éven felüli, regisztrált felhasználók vehetnek részt.',
      isOpen: false
    },
    {
      question: 'Hogyan tudom beváltani a nyereményem?',
      answer: 'Navigálj a "Profilom" oldalra, ahol megtalálod a nyereményeidhez tartozó QR kódot. Ezt a kódot kell megmutatnod a Jägermeister promóterének, aki beolvassa azt és átadja a nyereményt.',
      isOpen: false
    },
    {
      question: 'Naponta hányszor játszhatok?',
      answer: 'Bármennyiszer! Viszont fontos tudnod: ha eléred az adott eseményre vonatkozó nyereménylimitünket, a játékot továbbra is folytathatod szórakozásból, de újabb nyereményt vagy ajándékot már nem fogsz kapni érte.',
      isOpen: false
    },
    {
      question: 'Meddig érvényesek a nyereményeim?',
      answer: 'A nyereményeket kizárólag a jelenlegi esemény helyszínén és annak időtartama alatt (zárásig, vagy amíg a promóterek a helyszínen vannak) tudod beváltani. Későbbi napokra vagy más szórakozóhelyekre nem vihetők át.',
      isOpen: false
    },
    {
      question: 'Mit tegyek, ha nem tölt be a játék?',
      answer: 'A szórakozóhelyeken a mobilnet sokszor leterhelt lehet. Próbáld meg frissíteni az oldalt, vagy csatlakozz a helyi WiFi hálózatra. Ha továbbra is gond van, mutasd meg a promóternek a képernyőt.',
      isOpen: false
    }
  ];

  toggleFaq(index: number): void {
    // Ha azt akarod, hogy egyszerre csak egy lehessen nyitva:
    // this.faqs.forEach((faq, i) => { if (i !== index) faq.isOpen = false; });
    
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }
}