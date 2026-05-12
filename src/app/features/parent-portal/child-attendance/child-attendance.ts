import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  ParentPortalService,
  AttendanceGeneralResumen,
  AttendanceGeneralDetalle,
} from '../data-access/parent-portal.store';
import { ChildAttendanceRecord } from '../../../core/models/parent-portal';

type TabType = 'general' | 'vivo';

@Component({
  selector: 'app-child-attendance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    MatTableModule, MatCardModule, MatIconModule, MatButtonModule,
    MatButtonToggleModule, MatProgressSpinnerModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './child-attendance.html',
  styleUrl: './child-attendance.scss',
})
export class ChildAttendance implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  // General attendance
  readonly resumen = signal<AttendanceGeneralResumen | null>(null);
  readonly detalle = signal<AttendanceGeneralDetalle[]>([]);
  readonly loadingGeneral = signal(true);

  // Live class attendance (legacy)
  readonly records = signal<ChildAttendanceRecord[]>([]);
  readonly loadingVivo = signal(true);

  readonly tab = signal<TabType>('general');

  readonly childId = computed<string>(() =>
    this.route.snapshot.paramMap.get('childId') ?? '',
  );

  // Legacy metrics
  readonly presentes = computed(() => this.records().filter(r => r.presente).length);
  readonly totalVivo = computed(() => this.records().length);
  readonly porcentajeVivo = computed(() => {
    const t = this.totalVivo();
    return t === 0 ? 0 : (this.presentes() / t) * 100;
  });

  readonly colsVivo = ['fecha', 'curso', 'estado'];

  ngOnInit() {
    const id = this.childId();
    if (!id) {
      this.loadingGeneral.set(false);
      this.loadingVivo.set(false);
      return;
    }

    // Cargar ambas en paralelo
    this.store.getChildAttendanceGeneral(id).subscribe({
      next: r => {
        this.resumen.set(r.data?.resumen ?? null);
        this.detalle.set(r.data?.detalle ?? []);
        this.loadingGeneral.set(false);
      },
      error: () => { this.loadingGeneral.set(false); },
    });

    this.store.getChildAttendance(id).subscribe({
      next: r => {
        this.records.set(r.data ?? []);
        this.loadingVivo.set(false);
      },
      error: () => { this.loadingVivo.set(false); },
    });
  }

  setTab(t: TabType) { this.tab.set(t); }

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
}
