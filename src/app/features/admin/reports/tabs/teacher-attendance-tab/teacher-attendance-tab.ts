import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReportsStore } from '../../data-access/reports.store';
import { ReportsService } from '@core/services/reports';
import { estadoDocenteChip, estadoDocenteLabel } from '../../_shared/chips.util';

@Component({
  selector: 'app-teacher-attendance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
  ],
  templateUrl: './teacher-attendance-tab.html',
  styleUrl: './teacher-attendance-tab.scss',
})
export class TeacherAttendanceTab {
  private svc = inject(ReportsService);
  readonly store = inject(ReportsStore);

  fechaDocentes = new Date().toISOString().slice(0, 10);
  rangoInicio = this.primerDiaMes();
  rangoFin = new Date().toISOString().slice(0, 10);

  // Helpers expuestos a la plantilla
  readonly estadoDocenteChip = estadoDocenteChip;
  readonly estadoDocenteLabel = estadoDocenteLabel;

  cargarDiario(): void {
    this.store.loadReporteDiario(this.fechaDocentes);
  }

  cargarResumen(): void {
    this.store.loadResumenDocentes(this.rangoInicio, this.rangoFin);
    this.store.loadAlertas(this.rangoInicio, this.rangoFin);
  }

  descargarDiario(): void {
    this.svc.downloadReporteDiarioXlsx(this.fechaDocentes).subscribe();
  }

  private primerDiaMes(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
}
