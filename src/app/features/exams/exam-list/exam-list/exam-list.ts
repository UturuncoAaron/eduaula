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
    // TODO: cuando JWT esté activo, obtener cursos del usuario y cargar exámenes de cada uno
    // Por ahora carga mock
    this.loading.set(false);
  }

  isActive(e: Exam): boolean {
    const now = Date.now();
    return e.activo
      && new Date(e.fecha_inicio).getTime() <= now
      && new Date(e.fecha_fin).getTime() >= now;
  }
}