import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';
import { Exam } from '../../../../core/models/exam';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-exam-list',
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatChipsModule,
    DatePipe, RouterLink, PageHeader, EmptyState
  ],
  templateUrl: './exam-list.html',
  styleUrl: './exam-list.scss',
})
export class ExamList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  exams = signal<Exam[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Course[]>('courses').subscribe({
      next: r => this.cargarExamenes(r.data),
      error: () => { this.exams.set([]); this.loading.set(false); },
    });
  }

  private cargarExamenes(cursos: Course[]) {
    if (!cursos.length) { this.exams.set([]); this.loading.set(false); return; }

    const reqs = cursos.map(c =>
      this.api.get<Exam[]>(`courses/${c.id}/exams`).pipe(
        map(r => r.data.map(e => ({ ...e, curso_id: c.id, curso: c.nombre }))),
        catchError(() => of([] as Exam[])),
      ),
    );
    forkJoin(reqs).subscribe(lists => {
      this.exams.set(lists.flat());
      this.loading.set(false);
    });
  }

  isAvailable(e: Exam): boolean {
    return !!e.activo && new Date(e.fecha_limite).getTime() >= Date.now();
  }
}
