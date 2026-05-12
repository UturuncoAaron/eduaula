import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { DatePipe, DecimalPipe } from '@angular/common';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import { ChildGrade } from '../../../core/models/parent-portal';

@Component({
  selector: 'app-child-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTableModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly allGrades = signal<ChildGrade[]>([]);
  readonly loading = signal(true);
  readonly cols = ['curso', 'titulo', 'tipo', 'nota', 'fecha'];

  readonly selectedBimestre = signal<number | null>(null);

  readonly childId = computed<string>(() =>
    this.route.snapshot.paramMap.get('childId') ?? '',
  );

  /** Bimestres disponibles. */
  readonly bimestres = computed(() => {
    const set = new Set<number>();
    for (const g of this.allGrades()) set.add(g.bimestre);
    return [...set].sort();
  });

  /** Notas filtradas. */
  readonly grades = computed(() => {
    const bim = this.selectedBimestre();
    const all = this.allGrades();
    return bim !== null ? all.filter(g => g.bimestre === bim) : all;
  });

  /** Resumen por bimestre. */
  readonly resumenBimestres = computed(() => {
    const map = new Map<number, { sum: number; count: number; periodo: string; anio: number }>();
    for (const g of this.allGrades()) {
      if (g.nota === null) continue;
      const cur = map.get(g.bimestre) ?? { sum: 0, count: 0, periodo: g.periodo, anio: g.anio };
      cur.sum += g.nota;
      cur.count++;
      if (!map.has(g.bimestre)) map.set(g.bimestre, cur);
    }
    return [...map.entries()]
      .map(([bim, v]) => ({
        bimestre: bim,
        promedio: v.count > 0 ? v.sum / v.count : null,
        periodo: v.periodo,
        anio: v.anio,
        evaluaciones: v.count,
      }))
      .sort((a, b) => a.bimestre - b.bimestre);
  });

  readonly promedioGeneral = computed(() => {
    const vals = this.allGrades()
      .map(g => g.nota)
      .filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildGrades(id).subscribe({
      next: r => {
        this.allGrades.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.allGrades.set([]);
        this.loading.set(false);
      },
    });
  }

  onBimestreChange(val: number | null) {
    this.selectedBimestre.set(val);
  }

  gradeColor(avg: number | null): string {
    if (avg === null) return '#64748b';
    if (avg >= 17) return '#16a34a';
    if (avg >= 14) return '#2563eb';
    if (avg >= 11) return '#ca8a04';
    return '#dc2626';
  }

  notaBadgeColor(nota: number | null): string {
    if (nota === null) return '#64748b';
    if (nota >= 18) return '#166534';
    if (nota >= 14) return '#1d4ed8';
    if (nota >= 11) return '#92400e';
    return '#991b1b';
  }

  notaBadgeBg(nota: number | null): string {
    if (nota === null) return '#f1f5f9';
    if (nota >= 18) return '#dcfce7';
    if (nota >= 14) return '#dbeafe';
    if (nota >= 11) return '#fef3c7';
    return '#fee2e2';
  }
}
