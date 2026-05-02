import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';

import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../../stores/parent-portal.store';
import { ChildGrade } from '../../../../core/models/parent-portal';

@Component({
  selector: 'app-child-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTableModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(ParentPortalService);

  readonly grades = signal<ChildGrade[]>([]);
  readonly loading = signal(true);
  readonly cols = ['curso', 'bimestre', 'nota_tareas', 'nota_participacion', 'nota_final', 'escala'];

  readonly childId = computed<string>(() =>
    this.route.snapshot.paramMap.get('childId') ?? '',
  );

  ngOnInit() {
    const id = this.childId();
    if (!id) { this.loading.set(false); return; }

    this.store.getChildGrades(id).subscribe({
      next: r => {
        this.grades.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.grades.set([]);
        this.loading.set(false);
      },
    });
  }

  escalaColor(escala: string | null): string {
    switch (escala) {
      case 'AD': return '#166534';
      case 'A':  return '#1d4ed8';
      case 'B':  return '#92400e';
      case 'C':  return '#991b1b';
      default:   return '#6b7280';
    }
  }

  escalaBg(escala: string | null): string {
    switch (escala) {
      case 'AD': return '#dcfce7';
      case 'A':  return '#dbeafe';
      case 'B':  return '#fef3c7';
      case 'C':  return '#fee2e2';
      default:   return '#f1f5f9';
    }
  }
}
