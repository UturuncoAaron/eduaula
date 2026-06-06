import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
// 1. Añadimos DatePipe al import nativo de @angular/common
import { DecimalPipe, DatePipe, Location } from '@angular/common';
import { take } from 'rxjs/operators';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import type { CursoGradesGroup } from '../../../core/models/parent-portal';

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

@Component({
  selector: 'app-child-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    DatePipe, // 2. Registramos el DatePipe en los módulos standalone recomendados
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly store = inject(ParentPortalService);

  readonly allGroups = signal<CursoGradesGroup[]>([]);
  readonly loading = signal(true);
  readonly selectedBimestre = signal<number | null>(null);

  readonly childId = computed<string>(
    () => this.route.snapshot.paramMap.get('childId') ?? ''
  );

  readonly grupos = computed<CursoGradesGroup[]>(() => {
    const bim = this.selectedBimestre();
    const all = this.allGroups();
    return bim !== null ? all.filter(g => g.bimestre === bim) : all;
  });

  readonly resumenBimestres = computed(() => {
    const map = new Map<number, { sum: number; count: number; nombre: string; anio: number }>();
    for (const g of this.allGroups()) {
      if (g.promedio === null) continue;
      const cur = map.get(g.bimestre) ?? { sum: 0, count: 0, nombre: g.periodo_nombre, anio: g.anio };
      cur.sum += g.promedio;
      cur.count++;
      map.set(g.bimestre, cur);
    }
    return [...map.entries()]
      .map(([bimestre, v]) => ({
        bimestre,
        promedio: v.count > 0 ? v.sum / v.count : null,
        nombre: v.nombre,
        anio: v.anio,
        cursos: v.count,
      }))
      .sort((a, b) => a.bimestre - b.bimestre);
  });

  readonly promedioGeneral = computed<number | null>(() => {
    const vals = this.allGroups()
      .map(g => g.promedio)
      .filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  ngOnInit(): void {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildGrades(id)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          const data = res.data ?? [];
          this.allGroups.set(data);
          const bims = [...new Set(data.map(g => g.bimestre))].sort((a, b) => a - b);
          if (bims.length > 0) this.selectedBimestre.set(bims[bims.length - 1]);
          this.loading.set(false);
        },
        error: () => {
          this.allGroups.set([]);
          this.loading.set(false);
        },
      });
  }

  back(): void {
    this.location.back();
  }

  selectBimestre(bim: number): void {
    this.selectedBimestre.set(this.selectedBimestre() === bim ? null : bim);
  }

  goToCurso(grupo: CursoGradesGroup): void {
    this.router.navigate([grupo.curso_id], { relativeTo: this.route });
  }

  getNotaStyle(nota: number | null): GradeStyle {
    if (nota === null) return { color: '#64748b', bg: '#f1f5f9', label: 'Sin Nota' };
    const rango = RANGOS_CALIFICACION.find(r => nota >= r.min && nota <= r.max);
    return rango ?? { color: '#64748b', bg: '#f1f5f9', label: '—' };
  }

  trackByCurso(_: number, g: CursoGradesGroup): string {
    return `${g.curso_id}_${g.periodo_id}_${g.bimestre}`;
  }
}