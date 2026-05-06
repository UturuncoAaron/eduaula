import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CourseService } from '../data-access/course.store';
import { Material } from '../../../core/models/course';

export interface MaterialPreviewData {
  courseId: string;
  material: Material;
}

type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'office' | 'youtube' | 'iframe' | 'unsupported';

@Component({
  selector: 'app-material-preview',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './material-preview.html',
  styleUrl: './material-preview.scss',
})
export class MaterialPreview {
  private csSvc = inject(CourseService);
  private sanitizer = inject(DomSanitizer);
  private ref = inject<MatDialogRef<MaterialPreview>>(MatDialogRef);
  readonly data = inject<MaterialPreviewData>(MAT_DIALOG_DATA);

  loading = signal(true);
  errorMsg = signal<string | null>(null);
  previewUrl = signal<string | null>(null);
  effectiveMime = signal<string | null>(null);
  filename = signal<string>(this.data.material.titulo);

  kind = computed<PreviewKind>(() => {
    const m = this.data.material;
    const mime = (this.effectiveMime() ?? m.mime_type ?? '').toLowerCase();
    const url = (this.previewUrl() ?? m.url ?? '').toLowerCase();
    const ext = url.split('?')[0].split('.').pop() ?? '';

    if (m.tipo === 'link' || (!m.storage_key && m.url)) {
      if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
      if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
      if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
      if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
      return 'iframe';
    }

    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
    if (
      ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) ||
      mime.includes('officedocument') ||
      mime.includes('msword') ||
      mime.includes('ms-excel') ||
      mime.includes('ms-powerpoint')
    ) {
      return 'office';
    }
    return 'unsupported';
  });

  safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.previewUrl();
    if (!url) return null;
    const k = this.kind();
    if (k === 'office') {
      const wrapped = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(wrapped);
    }
    if (k === 'youtube') {
      const id = this.extractYoutubeId(url);
      const embed = id ? `https://www.youtube.com/embed/${id}` : url;
      return this.sanitizer.bypassSecurityTrustResourceUrl(embed);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  ngOnInit() {
    this.cargarPreview();
  }

  private cargarPreview() {
    this.csSvc.getMaterialPreview(this.data.courseId, this.data.material.id).subscribe({
      next: res => {
        this.previewUrl.set(res.data.url);
        this.effectiveMime.set(res.data.mime_type);
        if (res.data.filename) this.filename.set(res.data.filename);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar la vista previa');
        this.loading.set(false);
      },
    });
  }

  private extractYoutubeId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  abrirEnNuevaPestana() {
    const url = this.previewUrl();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  descargar() {
    this.csSvc.getMaterialDownload(this.data.courseId, this.data.material.id).subscribe({
      next: res => {
        const url = res.data.url;
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    });
  }

  cerrar() {
    this.ref.close();
  }
}
