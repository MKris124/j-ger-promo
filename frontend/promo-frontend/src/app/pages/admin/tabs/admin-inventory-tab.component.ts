import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminInventoryItemComponent } from './admin-inventory-item.component'; // ha külön van

@Component({
  selector: 'app-admin-inventory-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminInventoryItemComponent],
  templateUrl: './admin-inventory-tab.component.html'
})
export class AdminInventoryTabComponent {
  @Input() inventoryItems: any[] = [];
  @Input() loading: boolean = false;
  @Input() newMerchName: string = '';
  @Input() newMerchIsLiquid: boolean = false;
  @Input() addStockMap: { [key: number]: number } = {};
  @Input() shotsPerLiter: number = 0;

  @Output() newMerchNameChange = new EventEmitter<string>();
  @Output() newMerchIsLiquidChange = new EventEmitter<boolean>();
  @Output() createMerch = new EventEmitter<void>();
  @Output() addStock = new EventEmitter<any>();
  @Output() subtractStock = new EventEmitter<any>();
  @Output() setQuickStock = new EventEmitter<{ item: any, value: number }>();
  @Output() deleteItem = new EventEmitter<any>();

  // Segédmetódus a quick stock esemény kényelmesebb továbbítására
  onSetQuickStock(item: any, value: number) {
    this.setQuickStock.emit({ item, value });
  }
}