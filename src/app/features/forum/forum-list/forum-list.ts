import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { Forum } from '../../../core/models/forum';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

interface ForumWithCourse extends Forum {
  curso_nombre?: string;
}

@Component({
  selector: 'app-forum-list',
  imports: [
    MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, DatePipe,
    PageHeader, EmptyState,
  ],
  templateUrl: './forum-list.html',
  styleUrl: './forum-list.scss',
})
export class ForumList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  forums = signal<ForumWithCourse[]>([]);
  loading = signal(true);
  courseId = '';

  /**
   * Abre el foro como sidebar (MatDialog lateral). Reusa el componente
   * `ForumThread` pasándole `forumId` + `courseId` por `MAT_DIALOG_DATA`.
   */
  async openForum(forum: ForumWithCourse): Promise<void> {
    const { ForumThread } = await import('../forum-thread/forum-thread');
    this.dialog.open(ForumThread, {
      width: '720px',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { right: '0' },
      panelClass: 'forum-thread-dialog-panel',
      autoFocus: false,
      data: {
        forumId: forum.id,
        courseId: forum.curso_id ?? this.courseId,
      },
    });
  }

  ngOnInit() {
    this.courseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';

    if (this.courseId) {
      this.loadForumsByCourse(this.courseId);
    } else {
      this.loadAllForums();
    }
  }

  loadForumsByCourse(courseId: string) {
    this.api.get<Forum[]>(`courses/${courseId}/forums`).subscribe({
      next: r => { this.forums.set(r.data); this.loading.set(false); },
      error: () => { this.forums.set([]); this.loading.set(false); },
    });
  }

  loadAllForums() {
    // 1 fetch global: el backend agrupa cursos+foros para el usuario actual
    // y nos devuelve `curso_nombre` ya enriquecido.
    this.api.get<ForumWithCourse[]>('forums/my').subscribe({
      next: res => {
        this.forums.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => { this.forums.set([]); this.loading.set(false); },
    });
  }
}