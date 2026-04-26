import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavSidebarComponent } from './nav-sidebar.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, NavSidebarComponent],
  template: `
    <header class="sticky top-0 z-30 w-full bg-jager-dark/90 backdrop-blur-lg shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
  
  <div class="flex items-center justify-between px-4 h-16 relative z-10">
    
    <div class="flex items-center gap-3">
      <button class="p-2 -ml-2 text-jager-orange hover:bg-jager-green-light rounded-xl transition-colors active:scale-90 transform-gpu">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      
      <div class="flex flex-col justify-center">
        <h1 class="text-xl font-['Oswald'] font-black tracking-widest text-jager-orange uppercase leading-none drop-shadow-md">
          {{ title }}
        </h1>
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-0.5">
          {{ currentTab }}
        </span>
      </div>
    </div>
    
    <div class="flex items-center">
      <ng-content></ng-content>
    </div>

  </div>
  
  <div class="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-jager-amber/40 to-transparent"></div>
</header>
  `,
})
export class PageHeaderComponent {
  @Input() title = 'JÄGERMEISTER PROMÓCIÓ';
  @Input() currentTab = '';
  @Output() profileClicked = new EventEmitter<void>();
  @Output() tabChanged = new EventEmitter<string>();
}