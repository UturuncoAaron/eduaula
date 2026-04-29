import { Component, signal } from '@angular/core';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { GradosTab } from '../grados-tab/grados-tab';
import { PeriodosTab } from '../periodos-tab/periodos-tab';

@Component({
  selector: 'app-academic-setup',
  standalone: true,
  imports: [MatTabsModule, MatIconModule, GradosTab, PeriodosTab],
  templateUrl: './academic-setup.html',
  styleUrl: './academic-setup.scss',
})
export class AcademicSetup {

  readonly tabVisited = signal<Record<number, boolean>>({ 0: true });

  onTabChange(event: MatTabChangeEvent): void {
    if (!this.tabVisited()[event.index]) {
      this.tabVisited.update(v => ({ ...v, [event.index]: true }));
    }
  }
}