import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ReportsStore } from '../../data-access/reports.store';
import { ReportsService } from '@core/services/reports';
import { ApiService } from '../../../../../core/services/api';
import { estadoDocenteChip, estadoDocenteLabel } from '../../_shared/chips.util';

interface PersonalColaborador {
  id: string;
  nombre: string;
  apellido_paterno: string;
  rol: string;
}

@Component({
  selector: 'app-teacher-attendance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './teacher-attendance-tab.html',
  styleUrl: './teacher-attendance-tab.scss'
})
export class TeacherAttendanceTab implements OnInit {
  private svc = inject(ReportsService);
  private api = inject(ApiService);
  readonly store = inject(ReportsStore);

  readonly personalLista = signal<PersonalColaborador[]>([]);

  personalId = '';
  rangoInicio = this.primerDiaMes();
  rangoFin = new Date().toISOString().slice(0, 10);

  readonly estadoDocenteChip = estadoDocenteChip;
  readonly estadoDocenteLabel = estadoDocenteLabel;

  ngOnInit(): void {
    this.api.get<PersonalColaborador[]>('users/personal-attendance-list').subscribe({
      next: (r: any) => this.personalLista.set(r?.data ?? r ?? [])
    });
  }

  cargarResumen(): void {
    this.store.loadResumenDocentes(this.rangoInicio, this.rangoFin);
  }

  descargarReportePersonal(formato: 'xlsx' | 'pdf'): void {
    this.svc.downloadConsolidatedReport({
      scope: 'personal_attendance_range',
      format: formato,
      cuenta_id: this.personalId || undefined,
      fecha_inicio: this.rangoInicio,
      fecha_fin: this.rangoFin
    }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_asistencia_personal.${formato}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    });
  }

  private primerDiaMes(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
}