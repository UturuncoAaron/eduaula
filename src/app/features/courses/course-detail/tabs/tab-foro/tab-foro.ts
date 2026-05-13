import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { Forum } from '../../../../../core/models/forum';
import { formDrawerConfig } from '../../../../../shared/utils/form-drawer';

@Component({
  selector: 'app-tab-foro',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, DatePipe],
  templateUrl: './tab-foro.html',
  styleUrl: './tab-foro.scss',
})
export class TabForo implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  // Recibe el `:id` del path /cursos/:id/foro via withComponentInputBinding.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  courseId = input.required<string>({ alias: 'id' });

  forums = signal<Forum[]>([]);
  loading = signal(true);

  ngOnInit() { this.loadForums(); }

  loadForums() {
    this.loading.set(true);
    this.api.get<Forum[]>(`courses/${this.courseId()}/forums`).subscribe({
      next: res => { this.forums.set(res.data ?? []); this.loading.set(false); },
      error: () => { this.forums.set([]); this.loading.set(false); },
    });
  }

  async openCreateForum() {
    const { ForumCreate } = await import(
      '../../../../forum/forum-create/forum-create'
    );
    const ref = this.dialog.open(ForumCreate, formDrawerConfig(this.courseId(), 'md'));
    ref.afterClosed().subscribe(r => { if (r) this.loadForums(); });
  }

  /**
   * Abre el thread del foro como dialog lateral (side-drawer) en vez
   * de navegar a /foro/:id. Mantiene al usuario en el contexto del
   * curso y evita el redirect al login que ocurría cuando el path
   * `/foro` no estaba registrado en el router.
   */
  async openForum(forum: Forum): Promise<void> {
    const { ForumThread } = await import(
      '../../../../forum/forum-thread/forum-thread'
    );
    this.dialog.open(ForumThread, {
      // Sidebar derecho: altura completa, ancho 720px en desktop,
      // se expande en móvil. Comportamiento idéntico al formDrawerConfig.
      width: '720px',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { right: '0' },
      panelClass: 'forum-thread-dialog-panel',
      autoFocus: false,
      data: { forumId: forum.id, courseId: this.courseId() },
    });
  }
}
