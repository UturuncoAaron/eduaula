import {
  ChangeDetectionStrategy, Component, computed, input, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  AsistenciaCurso, estadoBadgeClass, estadoLabel,
  fullName, fromBackendEstado,
} from '../asistencia.types';

interface AlumnoSummary {
  alumnoId: string;
  nombre: string;
  total: number;
  presente: number;
  tardanza: number;
  justificado: number;
  ausente: number;
  asistenciaPct: number;
}

@Component({
  selector: 'app-historial-asistencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, MatIconModule, MatButtonModule],
  templateUrl: './historial-asistencia.html',
  styleUrl: './historial-asistencia.scss',
})
export class HistorialAsistencia {
  readonly registros = input.required<AsistenciaCurso[]>();
  readonly showByAlumno = input.required<boolean>();

  // ── Estado de colapso de cada panel ──
  readonly matrizAbierta = signal(false);   // cerrada por defecto (puede ser grande)
  readonly resumenAbierto = signal(true);    // abierta por defecto

  readonly badgeFor = estadoBadgeClass;
  readonly labelFor = estadoLabel;

  // ── Computed ──
  readonly cronologico = computed(() =>
    [...this.registros()].sort((a, b) => b.fecha.localeCompare(a.fecha)),
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
          total: 0, presente: 0, tardanza: 0,
          justificado: 0, ausente: 0, asistenciaPct: 0,
        };
        map.set(r.alumno_id, s);
      }
      s.total++;
      if (ui.estado === 'presente') s.presente++;
      else if (ui.estado === 'tardanza') s.tardanza++;
      else if (ui.estado === 'justificado') s.justificado++;
      else if (ui.estado === 'falto') s.ausente++;
    }

    for (const s of map.values()) {
      s.asistenciaPct = s.total > 0
        ? Math.round(((s.presente + s.tardanza + s.justificado) / s.total) * 100)
        : 0;
    }

    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly fechas = computed(() =>
    [...new Set(this.registros().map(r => r.fecha))].sort((a, b) => a.localeCompare(b)),
  );

  readonly matriz = computed(() => {
    const m = new Map<string, Map<string, AsistenciaCurso>>();
    for (const r of this.registros()) {
      if (!m.has(r.alumno_id)) m.set(r.alumno_id, new Map());
      m.get(r.alumno_id)!.set(r.fecha, r);
    }
    return m;
  });

  // ── Stats generales para el header ──
  readonly statsGlobales = computed(() => {
    const alumnos = this.porAlumno();
    if (!alumnos.length) return null;
    const pct = alumnos.reduce((s, a) => s + a.asistenciaPct, 0) / alumnos.length;
    const ausentes = alumnos.filter(a => a.ausente > 0).length;
    return { promedioPct: Math.round(pct), ausentes, totalAlumnos: alumnos.length };
  });

  formatEstado(estado: string, obs?: string | null) {
    return fromBackendEstado(estado, obs);
  }

  estadoEnFecha(alumnoId: string, fecha: string): AsistenciaCurso | undefined {
    return this.matriz().get(alumnoId)?.get(fecha);
  }

  toggleMatriz() { this.matrizAbierta.update(v => !v); }
  toggleResumen() { this.resumenAbierto.update(v => !v); }
}