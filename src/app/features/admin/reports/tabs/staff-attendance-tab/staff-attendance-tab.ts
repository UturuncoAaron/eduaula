import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ReportsStore } from '../../data-access/reports.store';
import { ReportsService } from '@core/services/reports';
import { ApiService } from '../../../../../core/services/api';

interface StaffColaborador {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  cargo: string;
}

@Component({
  selector: 'app-staff-attendance-tab',
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
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './staff-attendance-tab.html',
  styleUrl: './staff-attendance-tab.scss'
})
export class StaffAttendanceTab implements OnInit {
  private svc = inject(ReportsService);
  private api = inject(ApiService);
  readonly store = inject(ReportsStore);

  readonly staffLista = signal<StaffColaborador[]>([]);

  personalId = '';
  rangoInicio = this.primerDiaMes();
  rangoFin = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    this.api.get<StaffColaborador[]>('admin/users/staff?limit=100').subscribe({
      next: (r: any) => this.staffLista.set(r?.data ?? r ?? [])
    });
  }

  cargarResumen(): void {
    if (this.store.loadResumenStaff) {
      this.store.loadResumenStaff(this.rangoInicio, this.rangoFin);
    }
  }

  descargarReporteStaff(formato: 'xlsx' | 'pdf'): void {
    this.svc.downloadConsolidatedReport({
      scope: 'staff_attendance_range',
      format: formato,
      cuenta_id: this.personalId || undefined,
      fecha_inicio: this.rangoInicio,
      fecha_fin: this.rangoFin
    }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_asistencia_staff.${formato}`;
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