import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  templateUrl: './loading-skeleton.html',
  styleUrl: './loading-skeleton.scss',
})
export class LoadingSkeleton {
  @Input() count = 4;
  get items() { return Array(this.count).fill(0); }
}