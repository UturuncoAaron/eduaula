import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-grade-badge',
  standalone: true,
  templateUrl: './grade-badge.html',
  styleUrl: './grade-badge.scss',
})
export class GradeBadge {
  @Input() nota?: number | null;
  @Input() escala?: string | null;

  get label(): string {
    if (this.escala) return this.escala;
    if (this.nota == null) return '—';
    if (this.nota >= 18) return 'AD';
    if (this.nota >= 14) return 'A';
    if (this.nota >= 11) return 'B';
    return 'C';
  }

  get cls(): string {
    const map: Record<string, string> = { AD: 'ad', A: 'a', B: 'b', C: 'c', '—': 'nd' };
    return map[this.label] ?? 'nd';
  }
}