import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Task } from '../../../../core/models/task';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatChipsModule,
    DatePipe, RouterLink, PageHeader, EmptyState, LoadingSkeleton,
  ],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
})
export class TaskList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  tasks = signal<Task[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Task[]>('tasks').subscribe({
      next: r => { this.tasks.set(r.data); this.loading.set(false); },
      error: () => {
        const d1 = new Date(); d1.setDate(d1.getDate() + 3);
        const d2 = new Date(); d2.setDate(d2.getDate() + 7);
        this.tasks.set([
          { id: '1', curso_id: '1', curso: 'Matemáticas', titulo: 'Ejercicios Capítulo 3', descripcion: 'Resolver ejercicios del libro pp. 45-48', fecha_entrega: d1.toISOString(), puntos_max: 20, activo: true },
          { id: '2', curso_id: '2', curso: 'Comunicación', titulo: 'Ensayo argumentativo', descripcion: 'Ensayo de 2 páginas sobre el tema asignado', fecha_entrega: d2.toISOString(), puntos_max: 20, activo: true },
        ]);
        this.loading.set(false);
      },
    });
  }

  isPending(t: Task): boolean {
    return new Date(t.fecha_entrega) > new Date();
  }
}
