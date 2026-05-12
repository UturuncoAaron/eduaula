import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';

import { AuthService } from '../../../core/auth/auth';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { ParentPortalService } from '../data-access/parent-portal.store';
import { ApiService } from '../../../core/services/api';
import { Child } from '../../../core/models/parent-portal';

interface HijoMetrics {
  alumnoId: string;
  promedioGeneral: number | null;
  porcentajeAsistencia: number | null;
  citasPendientes: number;
  asistioHoy: boolean | null;
}

@Component({
  selector: 'app-child-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DecimalPipe,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    EmptyState, UserAvatar,
  ],
  templateUrl: './child-selector.html',
  styleUrl: './child-selector.scss',
})
export class ChildSelector implements OnInit {
  readonly auth = inject(AuthService);
  private store = inject(ParentPortalService);
  private api = inject(ApiService);

  readonly children = signal<Child[]>([]);
  readonly metricsMap = signal<Map<string, HijoMetrics>>(new Map());
  readonly loading = signal(true);

  ngOnInit() {
    this.store.getChildren().subscribe({
      next: r => {
        this.children.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.children.set([]);
        this.loading.set(false);
      },
    });

    // Load metrics silently from dashboard
    this.api.get<any>('dashboard/resumen').subscribe({
      next: res => {
        const map = new Map<string, HijoMetrics>();
        for (const h of res.data?.hijos ?? []) {
          map.set(h.alumnoId, h);
        }
        this.metricsMap.set(map);
      },
      error: () => {},
    });
  }

  getMetrics(childId: string): HijoMetrics | undefined {
    return this.metricsMap().get(childId);
  }

  fullName(c: Child): string {
    return `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno ?? ''}`.trim();
  }

  attendanceColor(pct: number | null): string {
    if (pct === null) return '#94a3b8';
    if (pct >= 90) return '#16a34a';
    if (pct >= 75) return '#ca8a04';
    return '#dc2626';
  }

  gradeColor(avg: number | null): string {
    if (avg === null) return '#94a3b8';
    if (avg >= 17) return '#16a34a';
    if (avg >= 14) return '#2563eb';
    if (avg >= 11) return '#ca8a04';
    return '#dc2626';
  }
}
