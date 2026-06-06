import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe, DatePipe, Location } from '@angular/common';
import { take } from 'rxjs/operators';

import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import type { CursoGradesGroup, NotaItem } from '../../../core/models/parent-portal';

interface GradeStyle {
  color: string;
  bg: string;
  label: string;
}

const RANGOS_CALIFICACION = [
  { min: 17, max: 20, color: '#166534', bg: '#dcfce7', label: 'Excelente' },
  { min: 14, max: 16.99, color: '#1d4ed8', bg: '#dbeafe', label: 'Bueno' },
  { min: 11, max: 13.99, color: '#b45309', bg: '#fef3c7', label: 'Regular' },
  { min: 0, max: 10.99, color: '#991b1b', bg: '#fee2e2', label: 'Deficiente' },
];

const TIPO_EVALUACION_MAP: Record<string, string> = {
  tarea: 'Tarea',
  practica: 'Práctica',
  participacion: 'Participación',
  proyecto: 'Proyecto',
  examen: 'Examen',
  otro: 'Otro',
};

const TIPO_ICON: Record<string, string> = {
  tarea: 'assignment',
  practica: 'edit_note',
  participacion: 'forum',
  proyecto: 'rocket_launch',
  examen: 'quiz',
  otro: 'star',
};

@Component({
  selector: 'app-child-course-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    DatePipe,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './child-course-grades.html',
  styleUrl: './child-course-grades.scss',
})
export class ChildCourseGrades implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly store = inject(ParentPortalService);

  readonly loading = signal(true);
  readonly grupo = signal<CursoGradesGroup | null>(null);

  readonly childId = computed<string>(
    () => this.route.snapshot.paramMap.get('childId') ?? ''
  );
  readonly cursoId = computed<string>(
    () => this.route.snapshot.paramMap.get('cursoId') ?? ''
  );

  readonly promedioStyle = computed<GradeStyle>(() =>
    this.getNotaStyle(this.grupo()?.promedio ?? null)
  );

  ngOnInit(): void {
    const childId = this.childId();
    const cursoId = this.cursoId();
    if (!childId || !cursoId) { this.loading.set(false); return; }

    this.store.getChildGrades(childId)
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          const data: CursoGradesGroup[] = res.data ?? [];
          const found = data.find((g: CursoGradesGroup) => g.curso_id === cursoId) ?? null;
          this.grupo.set(found);
          this.loading.set(false);
        },
        error: () => {
          this.grupo.set(null);
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.location.back();
  }

  getNotaStyle(nota: number | null): GradeStyle {
    if (nota === null) return { color: '#64748b', bg: '#f1f5f9', label: 'Sin Nota' };
    const rango = RANGOS_CALIFICACION.find(r => nota >= r.min && nota <= r.max);
    return rango ?? { color: '#64748b', bg: '#f1f5f9', label: '—' };
  }

  tipoLabel(tipo: string): string {
    return TIPO_EVALUACION_MAP[tipo.toLowerCase()] ?? tipo;
  }

  tipoIcon(tipo: string): string {
    return TIPO_ICON[tipo.toLowerCase()] ?? 'star';
  }

  trackByNota(_: number, n: NotaItem): string {
    return n.nota_id;
  }
}