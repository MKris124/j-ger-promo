import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavSidebarComponent } from './nav-sidebar.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, NavSidebarComponent],
  template: `
    <header class="sticky top-0 z-30 w-full bg-[#060B08]/90 backdrop-blur-md shadow-lg border-b border-jager-green-light/40 will-change-transform transform-gpu">
      <div class="flex items-center justify-between px-3 md:px-4 h-16 relative z-10">
        
        <div class="flex items-center gap-3 md:gap-4">
          @if (isLoggedIn && showMenu) {
            <app-nav-sidebar
              (profileClicked)="profileClicked.emit()"
              (tabChanged)="tabChanged.emit($event)"
              class="shrink-0"
            ></app-nav-sidebar>
          }

          <img src="/assets/stag.png" class="w-7 h-7 shrink-0 invert sepia saturate-[5] hue-rotate-[340deg] brightness-110 drop-shadow-[0_0_5px_rgba(243,112,33,0.4)]" [ngClass]="{'hidden sm:block': isLoggedIn && showMenu}">
          
          <div class="flex flex-col justify-center">
            <h1 class="text-lg md:text-xl font-['Oswald'] font-black tracking-widest text-jager-orange uppercase leading-none drop-shadow-md">
              {{ title }}
            </h1>
            @if (currentTab) {
              <span class="text-[9px] md:text-[10px] font-black text-jager-amber uppercase tracking-[0.2em] mt-1 opacity-80">
                {{ currentTab }}
              </span>
            }
          </div>
        </div>
        
        <div class="flex items-center shrink-0">
          <ng-content></ng-content>
        </div>
      </div>
      <div class="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-jager-amber/40 to-transparent"></div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() title = 'JÄGER PROMO';
  @Input() currentTab = '';
  
  @Input() showMenu = true; 

  @Output() profileClicked = new EventEmitter<void>();
  @Output() tabChanged = new EventEmitter<string>();

  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}