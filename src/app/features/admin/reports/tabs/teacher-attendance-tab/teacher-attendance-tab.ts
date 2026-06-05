import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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

interface DocenteItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}

@Component({
  selector: 'app-teacher-attendance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './teacher-attendance-tab.html',
  styleUrl: './teacher-attendance-tab.scss'
})
export class TeacherAttendanceTab implements OnInit {
  private svc = inject(ReportsService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  readonly store = inject(ReportsStore);

  readonly personalLista = signal<DocenteItem[]>([]);

  personalId = '';
  rangoInicio = this.primerDiaMes();
  rangoFin = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    this.api.get<any>('admin/users/docentes?limit=200').subscribe({
      next: (r: any) => {
        const raw = r?.data ?? r ?? [];
        const lista = Array.isArray(raw) ? raw : (raw?.data ?? []);
        this.personalLista.set(lista);
        this.cdr.markForCheck();
      }
    });
  }

  cargarResumen(): void {
    this.store.loadResumenDocentes(this.rangoInicio, this.rangoFin, this.personalId || undefined);
  }

  descargarReporte(formato: 'xlsx' | 'pdf'): void {
    this.svc.downloadConsolidatedReport({
      scope: 'teacher_attendance_range',
      format: formato,
      fecha_inicio: this.rangoInicio,
      fecha_fin: this.rangoFin,
      ...(this.personalId && { cuenta_id: this.personalId })
    }).subscribe({
      next: (blob: Blob) => this.triggerDownload(blob, `asistencia_docentes_${this.rangoInicio}_${this.rangoFin}.${formato}`)
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private primerDiaMes(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
}