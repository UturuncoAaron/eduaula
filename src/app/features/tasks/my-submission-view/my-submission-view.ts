import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Submission, Task, tipoEntregaTarea } from '../../../core/models/task';
import { TaskService } from '../data-access/task.store';

export interface MySubmissionViewData {
  task: Task;
  submission: Submission | null;
}

type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'youtube' | 'drive' | 'link' | 'none';

@Component({
  selector: 'app-my-submission-view',
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './my-submission-view.html',
  styleUrl: './my-submission-view.scss',
})
export class MySubmissionView implements OnInit {
  private ref = inject<MatDialogRef<MySubmissionView>>(MatDialogRef);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private taskSvc = inject(TaskService);
  readonly data = inject<MySubmissionViewData>(MAT_DIALOG_DATA);

  task = this.data.task;
  submission = signal<Submission | null>(this.data.submission);
  signedUrl = signal<string | null>(null);
  downloading = signal(false);

  readonly esInteractiva = computed(() => tipoEntregaTarea(this.task) === 'interactiva');
  readonly vencida = computed(() => new Date(this.task.fecha_limite) < new Date());

  readonly estado = computed<'pendiente' | 'vencida' | 'entregada' | 'calificada'>(() => {
    const s = this.submission();
    if (s) return s.calificacion_final != null ? 'calificada' : 'entregada';
    return this.vencida() ? 'vencida' : 'pendiente';
  });

  readonly estadoLabel = computed(() => {
    switch (this.estado()) {
      case 'calificada':
        return `Calificada ${this.submission()!.calificacion_final}/${this.task.puntos_max}`;
      case 'entregada': return 'Entregada';
      case 'pendiente': return 'Pendiente';
      case 'vencida': return 'Vencida';
    }
  });

  readonly mediaKind = computed<MediaKind>(() => {
    const s = this.submission();
    if (!s?.storage_key) return 'none';
    const resource = this.signedUrl() ?? s.storage_key;
    const fileName = (s.nombre_archivo ?? s.storage_key).toLowerCase();
    if (/youtube\.com\/watch|youtu\.be\//i.test(resource)) return 'youtube';
    if (/drive\.google\.com\/file\//i.test(resource)) return 'drive';
    if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(fileName)) return 'image';
    if (/\.(mp4|webm|ogg|mov)(\?|$)/.test(fileName)) return 'video';
    if (/\.(mp3|wav|m4a)(\?|$)/.test(fileName)) return 'audio';
    if (/\.pdf(\?|$)/.test(fileName)) return 'pdf';
    if (/^https?:\/\//i.test(resource)) return 'link';
    return 'none';
  });

  readonly safeIframe = computed<SafeResourceUrl | null>(() => {
    const s = this.submission();
    if (!s?.storage_key) return null;
    const kind = this.mediaKind();
    const base = this.signedUrl() ?? s.storage_key;
    let final = base;
    if (kind === 'youtube') {
      const idMatch = base.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      final = idMatch ? `https://www.youtube.com/embed/${idMatch[1]}` : base;
    } else if (kind === 'drive') {
      final = base.replace(/\/view(\?.*)?$/, '/preview');
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(final);
  });

  puedeReenviar = computed(() => !this.vencida() && !this.esInteractiva());

  ngOnInit() {
    const s = this.submission();
    if (s?.storage_key && !/^https?:\/\//i.test(s.storage_key)) {
      this.downloading.set(true);
      this.taskSvc.getSubmissionFileUrl(s.id).subscribe({
        next: r => { this.signedUrl.set(r.data.url); this.downloading.set(false); },
        error: () => this.downloading.set(false),
      });
    }
  }

  abrirExterno() {
    const url = this.signedUrl() ?? this.submission()?.storage_key;
    if (url) window.open(url, '_blank', 'noopener');
  }

  reenviar() {
    this.ref.close('reenviar');
    this.router.navigate(['/tareas', this.task.id, 'entregar']);
  }

  cerrar() {
    this.ref.close();
  }
}