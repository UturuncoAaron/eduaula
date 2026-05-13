import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AttachmentDto } from '../../../core/services/attachments';

/**
 * Previsualización inline de adjuntos.
 * - Imágenes → <img>
 * - PDF/audio/video → ícono + botón abrir
 * - Resto → ícono + descargar
 */
@Component({
  selector: 'app-attachments-preview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <ul class="grid">
        @for (it of items(); track it.id) {
          <li class="tile">
            @if (isImage(it.mime_type) && it.preview_url) {
              <a [href]="it.download_url" target="_blank" rel="noopener" class="img-link">
                <img [src]="it.preview_url" [alt]="it.original_name" loading="lazy" />
              </a>
            } @else {
              <a [href]="it.download_url" target="_blank" rel="noopener" class="generic-link">
                <mat-icon class="ic">{{ iconFor(it.mime_type) }}</mat-icon>
                <span class="name">{{ it.original_name }}</span>
                <span class="size">{{ humanSize(it.size_bytes) }}</span>
              </a>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .grid {
      list-style: none; margin: .5rem 0 0; padding: 0;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: .5rem;
    }
    .tile { border: 1px solid rgba(0,0,0,.08); border-radius: 8px; overflow: hidden; background: #fff; }
    .img-link { display: block; }
    .img-link img { display: block; width: 100%; height: 120px; object-fit: cover; }
    .generic-link {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .25rem;
      padding: .85rem .5rem; text-decoration: none; color: inherit; min-height: 120px;
    }
    .ic { font-size: 36px; height: 36px; width: 36px; color: rgba(0,0,0,.6); }
    .name { font-size: .85rem; font-weight: 500; text-align: center;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .size { font-size: .72rem; color: rgba(0,0,0,.55); }
  `],
})
export class AttachmentsPreview {
  readonly items = input<AttachmentDto[]>([]);

  isImage(mime: string): boolean {
    return mime.startsWith('image/');
  }

  iconFor(mime: string): string {
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.startsWith('audio/')) return 'audio_file';
    if (mime.startsWith('video/')) return 'movie';
    if (mime.includes('word')) return 'description';
    if (mime.includes('sheet') || mime.includes('excel')) return 'table_chart';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slideshow';
    return 'attach_file';
  }

  humanSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
}
