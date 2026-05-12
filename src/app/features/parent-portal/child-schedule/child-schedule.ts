import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService, ScheduleSlot } from '../data-access/parent-portal.store';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIA_LABELS: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes',
};

@Component({
  selector: 'app-child-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatProgressSpinnerModule, PageHeader, EmptyState],
  templateUrl: './child-schedule.html',
  styleUrl: './child-schedule.scss',
})
export class ChildSchedule implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly slots = signal<ScheduleSlot[]>([]);
  readonly loading = signal(true);

  readonly childId = computed(() =>
    this.route.snapshot.paramMap.get('childId') ?? '',
  );

  readonly dias = DIAS;
  readonly diaLabel = DIA_LABELS;

  /** Horarios únicos ordenados para el eje Y de la grilla. */
  readonly horas = computed(() => {
    const set = new Set<string>();
    for (const s of this.slots()) {
      set.add(`${s.horaInicio}-${s.horaFin}`);
    }
    return [...set].sort();
  });

  /** Mapa [dia][horaInicio-horaFin] → slot */
  readonly grid = computed(() => {
    const map: Record<string, Record<string, ScheduleSlot>> = {};
    for (const d of DIAS) map[d] = {};
    for (const s of this.slots()) {
      const key = `${s.horaInicio}-${s.horaFin}`;
      map[s.diaSemana] = map[s.diaSemana] || {};
      map[s.diaSemana][key] = s;
    }
    return map;
  });

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildSchedule(id).subscribe({
      next: r => {
        this.slots.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.loading.set(false);
      },
    });
  }

  formatHora(range: string): string {
    const [start, end] = range.split('-');
    return `${start?.slice(0, 5)} - ${end?.slice(0, 5)}`;
  }

  slotColor(_slot: ScheduleSlot): string {
    return '#2563eb';
  }

  slotBg(_slot: ScheduleSlot): string {
    return '#eff6ff';
  }
}
