import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Grade } from '../../../../core/models/grade';
import { Course } from '../../../../core/models/course';
import { GradeBadge } from '../../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-my-grades',
  imports: [
    FormsModule, RouterLink,
    MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
    GradeBadge, PageHeader, EmptyState,
  ],
  templateUrl: './my-grades.html',
  styleUrl: './my-grades.scss',
})
export class MyGrades implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  grades = signal<Grade[]>([]);
  courses = signal<Course[]>([]);
  loading = signal(true);
  bimestre = 1;
  cols = ['curso', 'examenes', 'tareas', 'participacion', 'final', 'escala'];

  filtered = computed(() =>
    this.grades().filter(g => g.bimestre === this.bimestre)
  );

  ngOnInit() {
    if (this.auth.isDocente()) {
      this.loadCourses();
    } else {
      this.loadMyGrades();
    }
  }

  loadCourses() {
    this.api.get<Course[]>('courses').subscribe({
      next: r => { this.courses.set(r.data); this.loading.set(false); },
      error: () => { this.courses.set([]); this.loading.set(false); },
    });
  }

  loadMyGrades() {
    this.api.get<Grade[]>('grades/my').subscribe({
      next: r => { this.grades.set(r.data); this.loading.set(false); },
      error: () => {
        this.grades.set([
          { id: '1', alumno_id: '', curso_id: '1', curso: 'Matemáticas', periodo_id: 1, bimestre: 1, nota_examenes: 17, nota_tareas: 18, nota_participacion: 16, nota_final: 17, escala: 'A' },
          { id: '2', alumno_id: '', curso_id: '2', curso: 'Comunicación', periodo_id: 1, bimestre: 1, nota_examenes: 19, nota_tareas: 20, nota_participacion: 18, nota_final: 19, escala: 'AD' },
          { id: '3', alumno_id: '', curso_id: '1', curso: 'Matemáticas', periodo_id: 1, bimestre: 2, nota_examenes: 16, nota_tareas: 17, nota_participacion: 15, nota_final: 16, escala: 'A' },
        ]);
        this.loading.set(false);
      },
    });
  }
}