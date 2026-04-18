import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../../core/auth/auth';
import { ExamService } from '../../stores/exam';
import { Exam } from '../../../../core/models/exam';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatChipsModule,
    DatePipe, RouterLink, PageHeader, EmptyState, LoadingSkeleton,
  ],
  templateUrl: './exam-list.html',
  styleUrl: './exam-list.scss',
})
export class ExamList implements OnInit {
  readonly auth = inject(AuthService);
  private examSvc = inject(ExamService);

  exams = signal<Exam[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.examSvc.getExams().subscribe({
      next: r => { this.exams.set(r.data); this.loading.set(false); },
      error: () => {
        const now = new Date();
        const future = new Date(now.getTime() + 7200000);
        this.exams.set([
          { id: '1', curso_id: '1', curso: 'Matemáticas', titulo: 'Examen Bimestral 1', descripcion: 'Capítulos 1 al 3', fecha_inicio: now.toISOString(), fecha_fin: future.toISOString(), puntos_total: 20, activo: true },
          { id: '2', curso_id: '2', curso: 'Comunicación', titulo: 'Práctica calificada', descripcion: 'Redacción y comprensión', fecha_inicio: now.toISOString(), fecha_fin: future.toISOString(), puntos_total: 10, activo: false },
        ]);
        this.loading.set(false);
      },
    });
  }

  isActive(e: Exam): boolean {
    const now = Date.now();
    return e.activo
      && new Date(e.fecha_inicio).getTime() <= now
      && new Date(e.fecha_fin).getTime() >= now;
  }
}