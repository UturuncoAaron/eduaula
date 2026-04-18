import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../../core/services/api';
import { Grade } from '../../../../core/models/grade';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-my-grades',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatTableModule,
    MatFormFieldModule, MatSelectModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './my-grades.html',
  styleUrl: './my-grades.scss',
})
export class MyGrades implements OnInit {
  private api = inject(ApiService);

  grades = signal<Grade[]>([]);
  loading = signal(true);
  bimestre = 1;
  cols = ['curso', 'examenes', 'tareas', 'participacion', 'final', 'escala'];

  get filtered() {
    return this.grades().filter(g => g.bimestre === this.bimestre);
  }

  ngOnInit() {
    this.api.get<Grade[]>('grades/my').subscribe({
      next: r => { this.grades.set(r.data); this.loading.set(false); },
      error: () => {
        this.grades.set([
          { id: '1', alumno_id: '', curso_id: '1', curso: 'Matemáticas', periodo_id: 1, bimestre: 1, nota_examenes: 17, nota_tareas: 18, nota_participacion: 16, nota_final: 17, escala: 'A' },
          { id: '2', alumno_id: '', curso_id: '2', curso: 'Comunicación', periodo_id: 1, bimestre: 1, nota_examenes: 19, nota_tareas: 20, nota_participacion: 18, nota_final: 19, escala: 'AD' },
          { id: '3', alumno_id: '', curso_id: '3', curso: 'Historia', periodo_id: 1, bimestre: 1, nota_examenes: 13, nota_tareas: 12, nota_participacion: 11, nota_final: 12, escala: 'B' },
          { id: '4', alumno_id: '', curso_id: '1', curso: 'Matemáticas', periodo_id: 1, bimestre: 2, nota_examenes: 16, nota_tareas: 17, nota_participacion: 15, nota_final: 16, escala: 'A' },
          { id: '5', alumno_id: '', curso_id: '2', curso: 'Comunicación', periodo_id: 1, bimestre: 2, nota_examenes: 18, nota_tareas: 19, nota_participacion: 17, nota_final: 18, escala: 'AD' },
        ]);
        this.loading.set(false);
      },
    });
  }
}