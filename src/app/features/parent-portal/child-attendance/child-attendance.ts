import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import type {
  AttendanceGeneralDetalle,
  AttendanceGeneralResumen,
} from '../../../core/models/parent-portal';

@Component({
  selector: 'app-child-attendance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './child-attendance.html',
  styleUrl: './child-attendance.scss',
})
export class ChildAttendance implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly resumen = signal<AttendanceGeneralResumen | null>(null);
  readonly allDetalle = signal<AttendanceGeneralDetalle[]>([]);
  readonly loading = signal(true);

  /** Bimestre seleccionado para filtrar el detalle. */
  readonly selectedBimestre = signal<number | null>(null);

  readonly childId = computed<string>(
    () => this.route.snapshot.paramMap.get('childId') ?? '',
  );

  /** Bimestres disponibles en el detalle. */
  readonly bimestres = computed(() => {
    const set = new Set<number>();
    for (const d of this.allDetalle()) set.add(d.periodo_bimestre);
    return [...set].sort();
  });

  /** Detalle filtrado por bimestre. */
  readonly detalle = computed(() => {
    const bim = this.selectedBimestre();
    const all = this.allDetalle();
    return bim !== null ? all.filter(d => d.periodo_bimestre === bim) : all;
  });

  /** Resumen recalculado sobre el detalle filtrado (si hay filtro activo). */
  readonly resumenFiltrado = computed<AttendanceGeneralResumen | null>(() => {
    const bim = this.selectedBimestre();
    // Sin filtro → usar resumen del backend (cubre todo el año)
    if (bim === null) return this.resumen();

    const items = this.detalle();
    if (!items.length) return null;

    const total = items.length;
    const asistio = items.filter(d => d.estado === 'asistio').length;
    const tardanza = items.filter(d => d.estado === 'tardanza').length;
    const justificado = items.filter(d => d.estado === 'justificado').length;
    const falta = items.filter(d => d.estado === 'falta').length;
    const porcentaje = total > 0
      ? Math.round(((asistio + tardanza) / total) * 1000) / 10
      : null;

    return { total, asistio, tardanza, justificado, falta, porcentaje };
  });

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildAttendance(id).subscribe({
      next: r => {
        this.resumen.set(r.data?.resumen ?? null);
        this.allDetalle.set(r.data?.detalle ?? []);

        // Activar automáticamente el bimestre más reciente
        const bims = [...new Set((r.data?.detalle ?? []).map(d => d.periodo_bimestre))].sort();
        if (bims.length > 0) this.selectedBimestre.set(bims[bims.length - 1]);

        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  selectBimestre(bim: number) {
    this.selectedBimestre.set(this.selectedBimestre() === bim ? null : bim);
  }

  // ─── Helpers de estado ────────────────────────────────────────────────

  estadoColor(estado: string): string {
    switch (estado) {
      case 'asistio': return '#16a34a';
      case 'tardanza': return '#ca8a04';
      case 'justificado': return '#2563eb';
      case 'falta': return '#dc2626';
      default: return '#64748b';
    }
  }

  estadoBg(estado: string): string {
    switch (estado) {
      case 'asistio': return '#dcfce7';
      case 'tardanza': return '#fef3c7';
      case 'justificado': return '#dbeafe';
      case 'falta': return '#fee2e2';
      default: return '#f1f5f9';
    }
  }

  estadoLabel(estado: string): string {
    switch (estado) {
      case 'asistio': return 'Asistió';
      case 'tardanza': return 'Tardanza';
      case 'justificado': return 'Justificado';
      case 'falta': return 'Falta';
      default: return estado;
    }
  }

  estadoIcon(estado: string): string {
    switch (estado) {
      case 'asistio': return 'check_circle';
      case 'tardanza': return 'schedule';
      case 'justificado': return 'info';
      case 'falta': return 'cancel';
      default: return 'help';
    }
  }

  porcentajeColor(p: number | null): string {
    if (p === null) return '#64748b';
    if (p >= 90) return '#16a34a';
    if (p >= 75) return '#ca8a04';
    return '#dc2626';
  }

  trackByDetalle(_: number, d: AttendanceGeneralDetalle) { return d.id; }
}