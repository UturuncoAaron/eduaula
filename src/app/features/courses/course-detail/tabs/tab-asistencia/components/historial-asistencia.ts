import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../../../../../core/services/api';
import { ToastService } from 'ngx-toastr-notifier';
import { AsistenciaCurso, estadoBadgeClass, estadoLabel, fullName, fromBackendEstado } from '../asistencia.types';

interface AlumnoSummary {
  alumnoId: string;
  nombre: string;
  total: number;
  presente: number;
  tardanza: number;
  ausente: number;
  
  asistenciaPct: number;
}

@Component({
  selector: 'app-historial-asistencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatIconModule, MatButtonModule, MatExpansionModule,
    MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatInputModule
  ],
  templateUrl: './historial-asistencia.html',
  styleUrl: './historial-asistencia.scss',
})
export class HistorialAsistencia {
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  readonly registros = input.required<AsistenciaCurso[]>();
  readonly showByAlumno = input.required<boolean>();

  readonly cursoId = input<string | null>(null);
  readonly periodoId = input<string | null>(null);

  readonly filtroDesde = signal<Date | null>(null);
  readonly filtroHasta = signal<Date | null>(null);

  readonly dateRangeChange = output<{ desde: string | null; hasta: string | null }>();

  readonly badgeFor = estadoBadgeClass;
  readonly labelFor = estadoLabel;

  readonly cronologico = computed(() =>
    [...this.registros()].sort((a, b) => b.fecha.localeCompare(a.fecha))
  );
  readonly porAlumno = computed<AlumnoSummary[]>(() => {
    const map = new Map<string, AlumnoSummary>();
    for (const r of this.registros()) {
      const ui = fromBackendEstado(r.estado, r.observacion);
      let s = map.get(r.alumno_id);

      if (!s) {
        s = {
          alumnoId: r.alumno_id,
          nombre: fullName(r.alumno),
          total: 0,
          presente: 0,
          tardanza: 0,
          ausente: 0, // Mantenemos la propiedad 'ausente' para el resumen
          asistenciaPct: 0
        };
        map.set(r.alumno_id, s);
      }

      s.total += 1;

      // Mapeamos los nuevos estados a los contadores de la tabla
      if (ui.estado === 'presente') {
        s.presente += 1;
      } else if (ui.estado === 'tardanza') {
        s.tardanza += 1;
      } else if (ui.estado === 'falto') { // Corregido: 'falto' en lugar de 'ausente'
        s.ausente += 1;
      }
      else if (ui.estado === 'justificado') {
      }
      // 'justificado' no suma a faltas ni presentes en este resumen, 
      // pero si quieres que cuente, puedes agregarlo aquí.
    }

    for (const s of map.values()) {
      // Ajusta la fórmula si quieres que 'justificado' cuente como presente
      s.asistenciaPct = s.total > 0
        ? Math.round(((s.presente + s.tardanza * 0.5) / s.total) * 100)
        : 0;
    }

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly fechas = computed(() =>
    Array.from(new Set(this.registros().map(r => r.fecha))).sort((a, b) => a.localeCompare(b))
  );

  readonly matriz = computed(() => {
    const m = new Map<string, Map<string, AsistenciaCurso>>();
    for (const r of this.registros()) {
      if (!m.has(r.alumno_id)) m.set(r.alumno_id, new Map());
      m.get(r.alumno_id)!.set(r.fecha, r);
    }
    return m;
  });

  formatEstado(estado: string, obs?: string | null) {
    return fromBackendEstado(estado, obs);
  }

  estadoEnFecha(alumnoId: string, fecha: string): AsistenciaCurso | undefined {
    return this.matriz().get(alumnoId)?.get(fecha);
  }

  onDateRangeChange() {
    const desde = this.filtroDesde()?.toISOString().substring(0, 10) ?? null;
    const hasta = this.filtroHasta()?.toISOString().substring(0, 10) ?? null;

    if ((desde && hasta) || (!desde && !hasta)) {
      this.dateRangeChange.emit({ desde, hasta });
    }
  }

  descargarExcel() {
    const cid = this.cursoId();
    if (!cid) {
      this.toastr.warning('Faltan parámetros para exportar el reporte.');
      return;
    }

    const desde = this.filtroDesde()?.toISOString().substring(0, 10) ?? null;
    const hasta = this.filtroHasta()?.toISOString().substring(0, 10) ?? null;
    const pid = this.periodoId();

    this.toastr.info('Generando Excel contextual...');

    const params: Record<string, string> = { curso_id: cid };
    if (pid) params['periodo_id'] = pid;
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;

    this.api.getBlob(`reportes/asistencia/excel`, params).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Asistencia_${new Date().getTime()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.toastr.error('Error al generar el reporte Excel')
    });
  }
}