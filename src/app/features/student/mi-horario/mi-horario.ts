import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api';
import { WeekGrid } from '../../../shared/components/week-grid/week-grid';
import {
  WeekDia,
  WeekSlot,
} from '../../../shared/components/week-grid/week-grid.types';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

interface HorarioCurso {
  curso_id: string;
  curso_nombre: string;
  docente_nombre?: string;
  color?: string;
  slots: HorarioSlotRaw[];
}

interface HorarioSlotRaw {
  id: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
}

const COURSE_PALETTE = [
  '#42a5f5', '#ab47bc', '#26a69a', '#ef5350', '#ff7043',
  '#5c6bc0', '#66bb6a', '#ffca28', '#8d6e63', '#26c6da',
];

function colorForCourse(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 31 + courseId.charCodeAt(i)) >>> 0;
  }
  return COURSE_PALETTE[hash % COURSE_PALETTE.length];
}

@Component({
  selector: 'app-mi-horario',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    WeekGrid,
    PageHeader,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mi-horario.html',
  styleUrl: './mi-horario.scss',
})
export class MiHorario implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly cursos = signal<HorarioCurso[]>([]);

  readonly slots = computed<WeekSlot[]>(() => {
    const out: WeekSlot[] = [];
    for (const c of this.cursos()) {
      const color = c.color ?? colorForCourse(c.curso_id);
      for (const s of c.slots) {
        if (!isWeekDia(s.dia_semana)) continue;
        out.push({
          id: `${c.curso_id}__${s.id}`,
          dia: s.dia_semana,
          horaInicio: normalizeHhmm(s.hora_inicio),
          horaFin: normalizeHhmm(s.hora_fin),
          title: c.curso_nombre,
          subtitle: `${normalizeHhmm(s.hora_inicio)}–${normalizeHhmm(s.hora_fin)}`,
          color,
          kind: 'course',
        });
      }
    }
    return out;
  });

  ngOnInit() {
    this.api.get<HorarioCurso[]>('schedule/me').subscribe({
      next: r => {
        this.cursos.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.cursos.set([]);
        this.loading.set(false);
      },
    });
  }
}

function isWeekDia(s: string): s is WeekDia {
  return (
    s === 'lunes' ||
    s === 'martes' ||
    s === 'miercoles' ||
    s === 'jueves' ||
    s === 'viernes' ||
    s === 'sabado'
  );
}

function normalizeHhmm(s: string): string {
  // Backend a veces devuelve "07:00:00" — recortamos los segundos.
  return s.length > 5 ? s.slice(0, 5) : s;
}
