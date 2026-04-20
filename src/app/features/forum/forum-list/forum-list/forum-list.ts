import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Forum } from '../../../../core/models/forum';
import { Course } from '../../../../core/models/course';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

interface ForumWithCourse extends Forum {
  curso_nombre?: string;
}

@Component({
  selector: 'app-forum-list',
  imports: [
    MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, DatePipe,
    RouterLink, PageHeader, EmptyState,
  ],
  templateUrl: './forum-list.html',
  styleUrl: './forum-list.scss',
})
export class ForumList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  forums = signal<ForumWithCourse[]>([]);
  loading = signal(true);
  courseId = '';

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
    this.api.get<Course[]>('courses').subscribe({
      next: res => {
        const courses = res.data;
        if (!courses.length) { this.loading.set(false); return; }

        const requests = courses.map(c =>
          this.api.get<Forum[]>(`courses/${c.id}/forums`).toPromise()
            .then(r => (r?.data ?? []).map(f => ({ ...f, curso_nombre: c.nombre })))
            .catch(() => [])
        );

        Promise.all(requests).then(results => {
          const all = (results.flat()) as ForumWithCourse[];
          this.forums.set(all);
          this.loading.set(false);
        });
      },
      error: () => { this.forums.set([]); this.loading.set(false); },
    });
  }
}