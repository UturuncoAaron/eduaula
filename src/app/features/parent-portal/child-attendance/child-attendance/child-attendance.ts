import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../../stores/parent-portal.store';
import { ChildAttendanceRecord } from '../../../../core/models/parent-portal';

@Component({
  selector: 'app-child-attendance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe,
    MatTableModule, MatCardModule, MatIconModule, MatProgressSpinnerModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './child-attendance.html',
  styleUrl: './child-attendance.scss',
})
export class ChildAttendance implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly records = signal<ChildAttendanceRecord[]>([]);
  readonly loading = signal(true);
  readonly cols = ['fecha', 'clase', 'curso', 'estado'];

  readonly childId = computed<string>(() =>
    this.route.snapshot.paramMap.get('childId') ?? '',
  );

  readonly presentes = computed(() => this.records().filter(r => r.presente).length);
  readonly total = computed(() => this.records().length);
  readonly porcentaje = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : (this.presentes() / t) * 100;
  });

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildAttendance(id).subscribe({
      next: r => {
        this.records.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.records.set([]);
        this.loading.set(false);
      },
    });
  }
}
