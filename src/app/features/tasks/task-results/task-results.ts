import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskService } from '../data-access/task.store';
import { Submission, Task } from '../../../core/models/task';
import { GradeBadge } from '../../../shared/components/grade-badge/grade-badge';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-task-results',
  imports: [
    MatTableModule, MatCardModule, MatIconModule, MatProgressSpinnerModule,
    GradeBadge, PageHeader, EmptyState, DatePipe,
  ],
  templateUrl: './task-results.html',
  styleUrl: './task-results.scss',
})
export class TaskResults implements OnInit {
  private route = inject(ActivatedRoute);
  private taskSvc = inject(TaskService);

  taskId = this.route.snapshot.paramMap.get('id')!;

  task = signal<Task | null>(null);
  submissions = signal<Submission[]>([]);
  loading = signal(true);
  cols = ['alumno', 'puntaje', 'escala', 'fecha'];

  ngOnInit() {
    this.taskSvc.getTask(this.taskId).subscribe({
      next: r => this.task.set(r.data),
      error: () => this.task.set(null),
    });
    this.taskSvc.getSubmissions(this.taskId).subscribe({
      next: r => { this.submissions.set(r.data); this.loading.set(false); },
      error: () => { this.submissions.set([]); this.loading.set(false); },
    });
  }

  nombreCompleto(s: Submission): string {
    const a = s.alumno;
    if (!a) return '—';
    return `${a.apellido_paterno ?? ''} ${a.apellido_materno ?? ''}, ${a.nombre ?? ''}`.trim();
  }

  nota(s: Submission): number | null {
    return s.calificacion_final ?? s.calificacion_auto ?? null;
  }
}