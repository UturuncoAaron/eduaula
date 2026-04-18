import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../../core/services/api';
import { Grade } from '../../../../core/models/grade';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-child-grades',
  standalone: true,
  imports: [
    FormsModule, MatTableModule, MatCardModule,
    MatFormFieldModule, MatSelectModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './child-grades.html',
  styleUrl: './child-grades.scss',
})
export class ChildGrades implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  childId = this.route.snapshot.paramMap.get('childId')!;
  grades = signal<Grade[]>([]);
  bimestre = 1;
  cols = ['curso', 'final', 'escala'];

  get filtered() { return this.grades().filter(g => g.bimestre === this.bimestre); }

  ngOnInit() {
    this.api.get<Grade[]>(`parent/children/${this.childId}/grades`).subscribe({
      next: r => this.grades.set(r.data),
      error: () => this.grades.set([
        { id: '1', alumno_id: '', curso_id: '', curso: 'Matemáticas', periodo_id: 1, bimestre: 1, nota_final: 17, escala: 'A' },
        { id: '2', alumno_id: '', curso_id: '', curso: 'Comunicación', periodo_id: 1, bimestre: 1, nota_final: 19, escala: 'AD' },
        { id: '3', alumno_id: '', curso_id: '', curso: 'Historia', periodo_id: 1, bimestre: 1, nota_final: 12, escala: 'B' },
        { id: '4', alumno_id: '', curso_id: '', curso: 'Inglés', periodo_id: 1, bimestre: 1, nota_final: 8, escala: 'C' },
      ]),
    });
  }
}