import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-inventory-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: '../admin-inventory-item.component.html'
})
export class AdminInventoryItemComponent {
  @Input() item: any;
  @Input() addStockMap: { [key: number]: number } = {};

  @Output() addStock = new EventEmitter<any>();
  @Output() subtractStock = new EventEmitter<any>();
  @Output() setQuickStock = new EventEmitter<number>();
  @Output() deleteItem = new EventEmitter<any>();

  getStockPercent(stock: number): number {
    return Math.min((stock / 200) * 100, 100);
  }
}