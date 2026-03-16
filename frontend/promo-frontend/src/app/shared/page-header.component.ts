import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavSidebarComponent } from './nav-sidebar.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, NavSidebarComponent],
  template: `
    <header style="
      background:rgba(0,0,0,0.75);
      backdrop-filter:blur(12px);
      border-bottom:1px solid rgba(243,112,33,0.12);
      padding:10px 14px;
      display:flex;
      align-items:center;
      gap:10px;
      position:sticky;
      top:0;
      z-index:100;
      flex-shrink:0;
    ">
      <app-nav-sidebar
        (profileClicked)="profileClicked.emit()"
        (tabChanged)="tabChanged.emit($event)"
      ></app-nav-sidebar>

      <img src="/assets/stag.png" style="width:28px;height:28px;flex-shrink:0;filter:invert(1) sepia(1) saturate(5) hue-rotate(340deg) brightness(1.1);">
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;">
        <span style="color:#F37021;font-weight:800;letter-spacing:0.1em;font-size:13px;white-space:nowrap;">{{ title }}</span>
        @if (currentTab) {
          <span style="color:#374151;font-size:11px;">›</span>
          <span style="color:#d1d5db;font-size:12px;font-weight:500;white-space:nowrap;">{{ currentTab }}</span>
        }
      </div>

      <ng-content></ng-content>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() title = 'JÄGERMEISTER PROMÓCIÓ';
  @Input() currentTab = '';
  @Output() profileClicked = new EventEmitter<void>();
  @Output() tabChanged = new EventEmitter<string>();
}