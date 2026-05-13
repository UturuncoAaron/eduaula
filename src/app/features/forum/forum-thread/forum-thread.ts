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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ForumPost, ForumThread as ForumThreadData } from '../../../core/models/forum';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AttachmentsPreview } from '../../../shared/components/attachments-preview/attachments-preview';
import { StagedAttachmentsPicker } from '../../../shared/components/staged-attachments-picker/staged-attachments-picker';
import { AttachmentDto, AttachmentsService, ATTACHMENT_MAX_BYTES } from '../../../core/services/attachments';

/**
 * Datos opcionales cuando el thread se monta dentro de un MatDialog
 * en vez de la ruta /foro/:id. Permite reusar el componente como
 * sidebar/modal desde la tab Foro del curso o la lista de foros sin
 * salir del contexto.
 */
export interface ForumThreadDialogData {
  forumId: string;
  courseId: string;
}

@Component({
  selector: 'app-forum-thread',
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule, DatePipe, PageHeader,
    AttachmentsPreview, StagedAttachmentsPicker,
    MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './forum-thread.html',
  styleUrl: './forum-thread.scss',
})
export class ForumThread implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private fb = inject(FormBuilder);
  private readonly attachments = inject(AttachmentsService);
  /**
   * Cuando el componente vive dentro de un MatDialog estos dos están
   * presentes y tienen prioridad sobre los params de ruta. Permite que
   * el mismo ForumThread funcione como pantalla y como dialog sin
   * duplicar lógica.
   */
  private readonly dialogData = inject<ForumThreadDialogData | null>(
    MAT_DIALOG_DATA, { optional: true },
  );
  readonly dialogRef = inject<MatDialogRef<ForumThread> | null>(
    MatDialogRef, { optional: true },
  );

  forumId = this.dialogData?.forumId
    ?? this.route.snapshot.paramMap.get('id')!;
  courseId = this.dialogData?.courseId
    ?? this.route.snapshot.queryParamMap.get('courseId') ?? '';

  /** Renderizamos el header solo en modo pantalla (no dialog). */
  readonly isDialog = !!this.dialogRef;

  posts = signal<(ForumPost & { attachments?: AttachmentDto[] })[]>([]);
  forumTitle = signal('');
  forumDesc = signal<string | null>(null);
  loading = signal(true);
  sending = signal(false);

  /** Archivos elegidos por el usuario ANTES de publicar la respuesta. */
  stagedFiles = signal<File[]>([]);

  readonly maxFileBytes = ATTACHMENT_MAX_BYTES;
  readonly maxFiles = 5;

  form = this.fb.group({
    contenido: ['', [Validators.required, Validators.minLength(5)]],
  });

  /** Etiqueta legible para el rol del autor del post. */
  rolLabel(rol: string | undefined): string {
    switch (rol) {
      case 'docente': return 'Docente';
      case 'alumno': return 'Alumno';
      case 'padre': return 'Padre';
      case 'admin': return 'Admin';
      case 'auxiliar': return 'Auxiliar';
      case 'psicologa': return 'Psicología';
      default: return rol ?? '';
    }
  }

  /** Inicial del avatar, segura contra autor sin nombre. */
  initial(nombre: string | undefined | null): string {
    return (nombre ?? '?').charAt(0).toUpperCase();
  }

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
        const postId = r.data?.id;
        const files = this.stagedFiles();
        if (postId && files.length > 0) {
          // Sube cada archivo en paralelo, pero no falla todo el flujo si uno falla.
          forkJoin(
            files.map(f =>
              this.attachments.upload(f, 'forum_post', postId).pipe(catchError(() => of(null))),
            ),
          ).subscribe({
            next: results => {
              const failures = results.filter(x => x === null).length;
              if (failures > 0) {
                this.toastr.error(`No se pudieron subir ${failures} archivo(s)`);
              }
              this.finishReply();
            },
          });
        } else {
          this.finishReply();
        }
      },
      error: () => {
        this.toastr.error('Error al publicar');
        this.sending.set(false);
      },
    });
  }

  private finishReply(): void {
    this.toastr.success('Respuesta publicada');
    this.form.reset();
    this.stagedFiles.set([]);
    this.sending.set(false);
    this.loadPosts();
  }
}