import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { ForumPost, ForumThread as ForumThreadData } from '../../../../core/models/forum';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-forum-thread',
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
    DatePipe, PageHeader,
  ],
  templateUrl: './forum-thread.html',
  styleUrl: './forum-thread.scss',
})
export class ForumThread implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  forumId = this.route.snapshot.paramMap.get('id')!;
  courseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';

  posts = signal<ForumPost[]>([]);
  forumTitle = signal('');
  forumDesc = signal<string | null>(null);
  loading = signal(true);
  sending = signal(false);

  form = this.fb.group({
    contenido: ['', [Validators.required, Validators.minLength(5)]],
  });

  ngOnInit() { this.loadPosts(); }

  loadPosts() {
    this.loading.set(true);
    this.api.get<ForumThreadData>(`courses/${this.courseId}/forums/${this.forumId}`).subscribe({
      next: r => {
        this.forumTitle.set(r.data.forum?.titulo ?? '');
        this.forumDesc.set(r.data.forum?.descripcion ?? null);
        this.posts.set(r.data.posts ?? []);
        this.loading.set(false);
      },
      error: () => { this.posts.set([]); this.loading.set(false); },
    });
  }

  reply() {
    if (this.form.invalid) return;
    this.sending.set(true);
    this.api.post(
      `courses/${this.courseId}/forums/${this.forumId}/posts`,
      this.form.value
    ).subscribe({
      next: () => {
        this.snack.open('Respuesta publicada', 'OK', { duration: 2000 });
        this.form.reset();
        this.sending.set(false);
        this.loadPosts();
      },
      error: () => {
        this.snack.open('Error al publicar', 'OK', { duration: 2000 });
        this.sending.set(false);
      },
    });
  }
}