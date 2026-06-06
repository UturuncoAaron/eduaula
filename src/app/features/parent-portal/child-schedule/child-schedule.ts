import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { WeekGrid } from '../../../shared/components/week-grid/week-grid';
import { WeekSlot, WeekDia } from '../../../shared/components/week-grid/week-grid.types';
import { ParentPortalService, ScheduleSlot } from '../data-access/parent-portal.store';

@Component({
  selector: 'app-child-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule, PageHeader, EmptyState, WeekGrid],
  templateUrl: './child-schedule.html',
  styleUrl: './child-schedule.scss',
})
export class ChildSchedule implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  private readonly rawSlots = signal<ScheduleSlot[]>([]);
  readonly loading = signal(true);

  readonly childId = computed(() => this.route.snapshot.paramMap.get('childId') ?? '');

  readonly mappedSlots = computed<WeekSlot[]>(() => {
    return this.rawSlots().map((s) => {
      const horaInicioClean = s.horaInicio.slice(0, 5);
      const horaFinClean = s.horaFin.slice(0, 5);

      let subtitulo = '';
      if (s.docente && s.aula) {
        subtitulo = `${s.docente} · Aula ${s.aula}`;
      } else if (s.docente) {
        subtitulo = s.docente;
      } else if (s.aula) {
        subtitulo = `Aula ${s.aula}`;
      }

      const fallbackId = `${s.diaSemana}-${horaInicioClean}-${s.curso.replace(/\s+/g, '')}`;

      return {
        id: (s as any).id?.toString() || (s as any).idCursoSeccion?.toString() || fallbackId,
        dia: s.diaSemana.toLowerCase() as WeekDia,
        horaInicio: horaInicioClean,
        horaFin: horaFinClean,
        title: s.curso,
        subtitle: subtitulo,
        kind: 'course',
        color: (s as any).color || null // <--- Mapeo dinámico del color de tu base de datos
      };
    });
  });
  ngOnInit() {
    const id = this.childId();
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.store.getChildSchedule(id).subscribe({
      next: (r) => {
        this.rawSlots.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.rawSlots.set([]);
        this.loading.set(false);
      },
    });
  }
}