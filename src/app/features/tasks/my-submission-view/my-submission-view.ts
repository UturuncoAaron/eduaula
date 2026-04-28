import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Submission, Task } from '../../../core/models/task';

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
export class MySubmissionView {
  private ref = inject<MatDialogRef<MySubmissionView>>(MatDialogRef);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  readonly data = inject<MySubmissionViewData>(MAT_DIALOG_DATA);

  task = this.data.task;
  submission = signal<Submission | null>(this.data.submission);

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
    const url = this.submission()?.storage_key;
    if (!url) return 'none';
    const low = url.toLowerCase();
    if (/youtube\.com\/watch|youtu\.be\//i.test(url)) return 'youtube';
    if (/drive\.google\.com\/file\//i.test(url)) return 'drive';
    if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(low)) return 'image';
    if (/\.(mp4|webm|ogg|mov)(\?|$)/.test(low)) return 'video';
    if (/\.(mp3|wav|m4a)(\?|$)/.test(low)) return 'audio';
    if (/\.pdf(\?|$)/.test(low)) return 'pdf';
    if (/^https?:\/\//i.test(url)) return 'link';
    return 'none';
  });

  readonly safeIframe = computed<SafeResourceUrl | null>(() => {
    const url = this.submission()?.storage_key;
    if (!url) return null;
    const kind = this.mediaKind();
    let final = url;
    if (kind === 'youtube') {
      const idMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      final = idMatch ? `https://www.youtube.com/embed/${idMatch[1]}` : url;
    } else if (kind === 'drive') {
      final = url.replace(/\/view(\?.*)?$/, '/preview');
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(final);
  });

  puedeReenviar = computed(() => !this.vencida());

  abrirExterno() {
    const url = this.submission()?.storage_key;
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
