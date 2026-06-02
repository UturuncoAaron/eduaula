import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import type { CursoGradesGroup, NotaItem } from '../../../core/models/parent-portal';

@Component({
  selector: 'app-child-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly allGroups = signal<CursoGradesGroup[]>([]);
  readonly loading = signal(true);
  readonly selectedBimestre = signal<number | null>(null);

  readonly childId = computed<string>(
    () => this.route.snapshot.paramMap.get('childId') ?? '',
  );

  /** Bimestres disponibles en los datos cargados. */
  readonly bimestres = computed(() => {
    const set = new Set<number>();
    for (const g of this.allGroups()) set.add(g.bimestre);
    return [...set].sort();
  });

  /** Grupos filtrados por bimestre seleccionado. */
  readonly grupos = computed(() => {
    const bim = this.selectedBimestre();
    const all = this.allGroups();
    return bim !== null ? all.filter(g => g.bimestre === bim) : all;
  });

  /** Resumen por bimestre: promedio de promedios de cursos con nota. */
  readonly resumenBimestres = computed(() => {
    const map = new Map<number, { sum: number; count: number; nombre: string; anio: number }>();

    for (const g of this.allGroups()) {
      if (g.promedio === null) continue;
      const cur = map.get(g.bimestre) ?? {
        sum: 0, count: 0,
        nombre: g.periodo_nombre,
        anio: g.anio,
      };
      cur.sum += g.promedio;
      cur.count++;
      map.set(g.bimestre, cur);
    }

    return [...map.entries()]
      .map(([bimestre, v]) => ({
        bimestre,
        promedio: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : null,
        nombre: v.nombre,
        anio: v.anio,
        cursos: v.count,
      }))
      .sort((a, b) => a.bimestre - b.bimestre);
  });

  /** Promedio general sobre todos los bimestres. */
  readonly promedioGeneral = computed(() => {
    const vals = this.allGroups()
      .map(g => g.promedio)
      .filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  });

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildGrades(id).subscribe({
      next: r => {
        this.allGroups.set(r.data ?? []);
        // Activar automáticamente el bimestre más reciente
        const bims = [...new Set((r.data ?? []).map(g => g.bimestre))].sort();
        if (bims.length > 0) this.selectedBimestre.set(bims[bims.length - 1]);
        this.loading.set(false);
      },
      error: () => {
        this.allGroups.set([]);
        this.loading.set(false);
      },
    });
  }

  selectBimestre(bim: number) {
    // Toggle: si ya está seleccionado, muestra todos
    this.selectedBimestre.set(this.selectedBimestre() === bim ? null : bim);
  }

  // ─── Helpers de color ──────────────────────────────────────────────────

  promedioColor(avg: number | null): string {
    if (avg === null) return '#64748b';
    if (avg >= 17) return '#16a34a';
    if (avg >= 14) return '#2563eb';
    if (avg >= 11) return '#ca8a04';
    return '#dc2626';
  }

  promedioBg(avg: number | null): string {
    if (avg === null) return '#f1f5f9';
    if (avg >= 17) return '#dcfce7';
    if (avg >= 14) return '#dbeafe';
    if (avg >= 11) return '#fef3c7';
    return '#fee2e2';
  }

  notaColor(nota: number | null): string {
    return this.promedioColor(nota);
  }

  notaBg(nota: number | null): string {
    return this.promedioBg(nota);
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      tarea: 'Tarea',
      practica: 'Práctica',
      participacion: 'Participación',
      proyecto: 'Proyecto',
      otro: 'Otro',
    };
    return map[tipo] ?? tipo;
  }

  trackByCurso(_: number, g: CursoGradesGroup) { return g.curso_id + g.periodo_id; }
  trackByNota(_: number, n: NotaItem) { return n.nota_id; }
}