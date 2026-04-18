import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago-pipe';

interface ForumPost {
  id: string;
  titulo: string;
  usuario: string;
  curso: string;
  created_at: string;
  replies: number;
  respondido: boolean;
}

@Component({
  selector: 'app-forum-list',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule,
    RouterLink, PageHeader, EmptyState, LoadingSkeleton, TimeAgoPipe,
  ],
  templateUrl: './forum-list.html',
  styleUrl: './forum-list.scss',
})
export class ForumList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  posts = signal<ForumPost[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<ForumPost[]>('forum').subscribe({
      next: r => { this.posts.set(r.data); this.loading.set(false); },
      error: () => {
        this.posts.set([
          { id: '1', titulo: '¿Cómo resolver el ejercicio 5 del capítulo 3?', usuario: 'García, Carlos', curso: 'Matemáticas', created_at: new Date(Date.now() - 3600000).toISOString(), replies: 3, respondido: true },
          { id: '2', titulo: 'No entiendo los vectores', usuario: 'López, María', curso: 'Matemáticas', created_at: new Date(Date.now() - 86400000).toISOString(), replies: 1, respondido: false },
          { id: '3', titulo: '¿Para qué sirve el ensayo argumentativo?', usuario: 'Torres, Pedro', curso: 'Comunicación', created_at: new Date(Date.now() - 172800000).toISOString(), replies: 2, respondido: true },
        ]);
        this.loading.set(false);
      },
    });
  }
}