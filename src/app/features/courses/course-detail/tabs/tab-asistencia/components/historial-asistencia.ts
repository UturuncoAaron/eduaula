import {
  ChangeDetectionStrategy, Component, computed, input,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  AsistenciaCurso, ESTADOS, estadoBadgeClass, estadoLabel, fullName,
} from '../asistencia.types';

interface AlumnoSummary {
  alumnoId: string;
  nombre: string;
  total: number;
  presente: number;
  tardanza: number;
  ausente: number;
  permiso: number;
  licencia: number;
  asistenciaPct: number;
}

/**
 * Tabla histórica de asistencias del curso.
 *
 * - Si el rol es **docente/admin** (`showByAlumno=true`): tabla agrupada por
 *   alumno con totales por estado y % de asistencia.
 * - Si el rol es **alumno** (`showByAlumno=false`): la lista cronológica del
 *   propio alumno (cards una por fecha).
 */
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
  /** True → vista docente/admin (resumen por alumno). False → vista alumno. */
  readonly showByAlumno = input.required<boolean>();

  readonly estados = ESTADOS;
  readonly badgeFor = estadoBadgeClass;
  readonly labelFor = estadoLabel;

  /** Lista cronológica (descendente por fecha) para la vista del alumno. */
  readonly cronologico = computed(() =>
    [...this.registros()].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  );

  /** Resumen por alumno para la vista docente. */
  readonly porAlumno = computed<AlumnoSummary[]>(() => {
    const map = new Map<string, AlumnoSummary>();
    for (const r of this.registros()) {
      const id = r.alumno_id;
      let s = map.get(id);
      if (!s) {
        s = {
          alumnoId: id,
          nombre: fullName(r.alumno),
          total: 0,
          presente: 0,
          tardanza: 0,
          ausente: 0,
          permiso: 0,
          licencia: 0,
          asistenciaPct: 0,
        };
        map.set(id, s);
      }
      s.total += 1;
      switch (r.estado) {
        case 'presente':  s.presente += 1; break;
        case 'tardanza':  s.tardanza += 1; break;
        case 'ausente':   s.ausente += 1; break;
        case 'permiso':   s.permiso += 1; break;
        case 'licencia':  s.licencia += 1; break;
      }
    }
    // % asistencia: presente + tardanza cuentan como asistencia parcial; permiso/licencia justificados; ausente cuenta como falta.
    for (const s of map.values()) {
      const asistido = s.presente + s.tardanza * 0.5 + s.permiso + s.licencia;
      s.asistenciaPct = s.total > 0 ? Math.round((asistido / s.total) * 100) : 0;
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  /** Fechas únicas (ordenadas desc) para las columnas de la tabla docente. */
  readonly fechas = computed(() => {
    const set = new Set(this.registros().map(r => r.fecha));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  });

  /** Mapa rápido: alumnoId → fecha → estado, para pintar la matriz docente. */
  readonly matriz = computed(() => {
    const m = new Map<string, Map<string, AsistenciaCurso>>();
    for (const r of this.registros()) {
      let inner = m.get(r.alumno_id);
      if (!inner) { inner = new Map(); m.set(r.alumno_id, inner); }
      inner.set(r.fecha, r);
    }
    return m;
  });

  estadoEnFecha(alumnoId: string, fecha: string): AsistenciaCurso | undefined {
    return this.matriz().get(alumnoId)?.get(fecha);
  }
}
