import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { Forum } from '../../../../../core/models/forum';

@Component({
  selector: 'app-tab-foro',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule,RouterLink,DatePipe],
  templateUrl: './tab-foro.html',
  styleUrl:    './tab-foro.scss',
})
export class TabForo implements OnInit {
  readonly auth  = inject(AuthService);
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);

  courseId = input.required<string>();

  forums  = signal<Forum[]>([]);
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
    const ref = this.dialog.open(ForumCreate, { data: this.courseId(), width: '500px' });
    ref.afterClosed().subscribe(r => { if (r) this.loadForums(); });
  }
}