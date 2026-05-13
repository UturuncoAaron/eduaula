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
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ForumPost, ForumThread as ForumThreadData } from '../../../core/models/forum';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AttachmentsUploader } from '../../../shared/components/attachments-uploader/attachments-uploader';
import { AttachmentsPreview } from '../../../shared/components/attachments-preview/attachments-preview';
import { AttachmentDto } from '../../../core/services/attachments';

@Component({
  selector: 'app-forum-thread',
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule, DatePipe, PageHeader,
    AttachmentsUploader, AttachmentsPreview,
  ],
  templateUrl: './forum-thread.html',
  styleUrl: './forum-thread.scss',
})
export class ForumThread implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private fb = inject(FormBuilder);

  forumId = this.route.snapshot.paramMap.get('id')!;
  courseId = this.route.snapshot.queryParamMap.get('courseId') ?? '';

  posts = signal<(ForumPost & { attachments?: AttachmentDto[] })[]>([]);
  forumTitle = signal('');
  forumDesc = signal<string | null>(null);
  loading = signal(true);
  sending = signal(false);

  /** ID temporal del post recién creado, para asociar adjuntos antes de publicar la reply final. */
  pendingPostId = signal<string | null>(null);

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
    this.api.post<{ id: string }>(
      `courses/${this.courseId}/forums/${this.forumId}/posts`,
      this.form.value
    ).subscribe({
      next: r => {
        // El post ya fue creado en backend con un id real; los adjuntos
        // que el usuario eligió antes se subieron contra `pendingPostId`
        // (un id provisional). Acá no necesitamos hacer nada extra porque
        // el componente de adjuntos publica directamente contra el endpoint
        // de attachments — pero como en este flujo creamos el post DESPUÉS,
        // el uploader sólo aparece luego de publicar (ver template).
        // Mantenemos referencia al último post creado para que el usuario
        // pueda adjuntar archivos a su respuesta recién creada.
        this.pendingPostId.set(r.data?.id ?? null);
        this.toastr.success('Respuesta publicada');
        this.form.reset();
        this.sending.set(false);
        this.loadPosts();
      },
      error: () => {
        this.toastr.error('Error al publicar');
        this.sending.set(false);
      },
    });
  }
}