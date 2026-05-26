import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  AsistenciaCurso, ESTADOS, estadoBadgeClass, estadoLabel, fullName, fromBackendEstado
} from '../asistencia.types';

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
  imports: [CommonModule, DatePipe, MatIconModule],
  templateUrl: './historial-asistencia.html',
  styleUrl: './historial-asistencia.scss',
})
export class HistorialAsistencia {
  readonly registros = input.required<AsistenciaCurso[]>();
  readonly showByAlumno = input.required<boolean>();

  readonly estados = ESTADOS;
  readonly badgeFor = estadoBadgeClass;
  readonly labelFor = estadoLabel;

  // Método auxiliar para el template
  formatEstado(estado: string, obs?: string | null) {
    return fromBackendEstado(estado, obs);
  }

  readonly cronologico = computed(() =>
    [...this.registros()].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  );

  readonly porAlumno = computed<AlumnoSummary[]>(() => {
    const map = new Map<string, AlumnoSummary>();
    for (const r of this.registros()) {
      const ui = fromBackendEstado(r.estado, r.observacion);
      let s = map.get(r.alumno_id);
      if (!s) {
        s = { alumnoId: r.alumno_id, nombre: fullName(r.alumno), total: 0, presente: 0, tardanza: 0, ausente: 0, asistenciaPct: 0 };
        map.set(r.alumno_id, s);
      }
      s.total += 1;
      if (ui.estado === 'presente') s.presente += 1;
      else if (ui.estado === 'tardanza') s.tardanza += 1;
      else if (ui.estado === 'ausente') s.ausente += 1;
    }
    for (const s of map.values()) {
      s.asistenciaPct = s.total > 0 ? Math.round(((s.presente + s.tardanza * 0.5) / s.total) * 100) : 0;
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly fechas = computed(() => Array.from(new Set(this.registros().map(r => r.fecha))).sort((a, b) => b.localeCompare(a)));

  readonly matriz = computed(() => {
    const m = new Map<string, Map<string, AsistenciaCurso>>();
    for (const r of this.registros()) {
      if (!m.has(r.alumno_id)) m.set(r.alumno_id, new Map());
      m.get(r.alumno_id)!.set(r.fecha, r);
    }
    return m;
  });

  estadoEnFecha(alumnoId: string, fecha: string): AsistenciaCurso | undefined {
    return this.matriz().get(alumnoId)?.get(fecha);
  }
}