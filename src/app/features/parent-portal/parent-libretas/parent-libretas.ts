import { Component, inject, signal, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';

interface Libreta {
  id: string;
  periodo_id: string;
  nombre_archivo: string | null;
  observaciones: string | null;
  url: string;
  created_at: string;
  leida?: boolean;
  periodo: {
    id: string;
    nombre: string;
    bimestre: number;
    anio: number;
  } | null;
}

interface HijoConLibretas {
  alumno_id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  grado: string | null;
  seccion: string | null;
  libretas: Libreta[];
}

interface PadreFullResponse {
  propias: Libreta[];
  hijos: HijoConLibretas[];
}

interface YearGroup {
  anio: number;
  items: Libreta[];
}

@Component({
  selector: 'app-parent-libretas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, NgTemplateOutlet, UpperCasePipe,
    MatIconModule, MatButtonModule, MatTooltipModule, MatTabsModule,
    PageHeader,
  ],
  templateUrl: './parent-libretas.html',
  styleUrl: './parent-libretas.scss',
})
export class ParentLibretas implements OnInit {
  private api = inject(ApiService);

  readonly propias = signal<Libreta[]>([]);
  readonly hijos = signal<HijoConLibretas[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  // ── Stats globales ─────────────────────────────────────────────────────
  readonly total = computed(() => {
    const propiasCount = this.propias().length;
    const hijosCount = this.hijos().reduce((s, h) => s + h.libretas.length, 0);
    return propiasCount + hijosCount;
  });

  readonly nuevas = computed(() => {
    const propiasNuevas = this.propias().filter(l => l.leida === false).length;
    const hijosNuevas = this.hijos()
      .flatMap(h => h.libretas)
      .filter(l => l.leida === false).length;
    return propiasNuevas + hijosNuevas;
  });

  readonly nuevasPropias = computed(() =>
    this.propias().filter(l => l.leida === false).length,
  );

  readonly nuevasHijos = computed(() =>
    this.hijos().flatMap(h => h.libretas).filter(l => l.leida === false).length,
  );

  readonly ultima = computed(() => {
    const todas = [
      ...this.propias(),
      ...this.hijos().flatMap(h => h.libretas),
    ];
    if (todas.length === 0) return null;
    return [...todas].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  });

  readonly gruposPropios = computed<YearGroup[]>(() => this.agruparPorAnio(this.propias()));

  // ── Carga inicial ──────────────────────────────────────────────────────
  ngOnInit() {
    this.api.get<PadreFullResponse>('libretas/padre/me/full').subscribe({
      next: r => {
        const data = r.data ?? { propias: [], hijos: [] };
        this.propias.set(data.propias ?? []);
        this.hijos.set(data.hijos ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  agruparPorAnio(libretas: Libreta[]): YearGroup[] {
    const map = new Map<number, Libreta[]>();
    for (const lb of libretas) {
      const anio = lb.periodo?.anio ?? new Date(lb.created_at).getFullYear();
      const arr = map.get(anio) ?? [];
      arr.push(lb);
      map.set(anio, arr);
    }
    return [...map.entries()]
      .map(([anio, items]) => ({
        anio,
        items: items.sort((a, b) => (b.periodo?.bimestre ?? 0) - (a.periodo?.bimestre ?? 0)),
      }))
      .sort((a, b) => b.anio - a.anio);
  }

  hijoNombre(h: HijoConLibretas): string {
    const mat = h.apellido_materno ? ` ${h.apellido_materno}` : '';
    return `${h.nombre} ${h.apellido_paterno}${mat}`;
  }

  nuevasDeHijo(h: HijoConLibretas): number {
    return h.libretas.filter(l => l.leida === false).length;
  }

  // ── Abrir + marcar lectura ─────────────────────────────────────────────
  open(lb: Libreta) {
    if (!lb.url) return;
    this.api.post(`libretas/${lb.id}/marcar-vista`, {}).subscribe({
      next: () => {
        // Marca local sin recargar todo
        this.propias.update(list =>
          list.map(item => item.id === lb.id ? { ...item, leida: true } : item),
        );
        this.hijos.update(list =>
          list.map(h => ({
            ...h,
            libretas: h.libretas.map(item =>
              item.id === lb.id ? { ...item, leida: true } : item,
            ),
          })),
        );
      },
      error: () => undefined,
    });
    window.open(lb.url, '_blank', 'noopener');
  }
}
