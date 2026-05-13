import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api';
import { CalendarGrid } from '../../../shared/components/calendar-grid/calendar-grid';
import { CalendarSlot } from '../../../shared/components/calendar-grid/calendar-grid.types';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

interface HorarioCurso {
  curso_id: string;
  curso_nombre: string;
  docente_nombre?: string;
  slots: HorarioSlotRaw[];
}

interface HorarioSlotRaw {
  id: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
}

@Component({
  selector: 'app-mi-horario',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    CalendarGrid,
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
  readonly slots = signal<CalendarSlot[]>([]);

  ngOnInit() {
    this.api.get<HorarioCurso[]>('schedule/me').subscribe({
      next: r => {
        this.slots.set(this.flatten(r.data ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.loading.set(false);
      },
    });
  }

  private flatten(cursos: HorarioCurso[]): CalendarSlot[] {
    const result: CalendarSlot[] = [];
    for (const c of cursos) {
      for (const s of c.slots) {
        result.push({
          id: String(s.id),
          title: c.curso_nombre,
          type: 'course',
          startTime: s.hora_inicio,
          endTime: s.hora_fin,
          diaSemana: s.dia_semana,
          meta: { docente: c.docente_nombre ?? '' },
        });
      }
    }
    return result;
  }
}
