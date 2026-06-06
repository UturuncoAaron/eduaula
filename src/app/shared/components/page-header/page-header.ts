import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() backRoute: string | null = null;
  @Output() backClick = new EventEmitter<void>();

  get hasBack(): boolean {
    return !!this.backRoute || this.backClick.observed;
  }

  onBack(): void {
    this.backClick.emit();
  }
}