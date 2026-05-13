import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ATTACHMENT_MAX_BYTES } from '../../../core/services/attachments';

/**
 * Selector de archivos "en stage" (NO sube nada).
 *
 * El parent recibe los `File` elegidos por `(filesChange)` y decide
 * cuándo subirlos (típicamente: después de crear el owner — post de foro,
 * comunicado, etc.). Esto evita tener que crear el owner antes de poder
 * adjuntar, mejorando UX.
 *
 * Reglas (defensa-en-profundidad — el backend también valida):
 *   - tamaño máximo por archivo: `maxBytes` (default 10 MB)
 *   - cantidad máxima:           `maxFiles` (default 5)
 *   - tipo MIME:                 cualquier (la whitelist está en backend)
 */
@Component({
  selector: 'app-staged-attachments-picker',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sap">
      <div
        class="dropzone"
        [class.dragging]="dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)">

        <input
          #fileInput
          type="file"
          multiple
          hidden
          [accept]="accept()"
          (change)="onFileSelected($event)" />

        <mat-icon class="dz-icon">attach_file</mat-icon>
        <div class="dz-copy">
          <p class="dz-title">{{ label() }}</p>
          <p class="dz-hint">
            Máx {{ maxMb() }} MB por archivo · hasta {{ maxFiles() }} archivos
          </p>
        </div>

        <button
          mat-stroked-button
          type="button"
          color="primary"
          (click)="fileInput.click()"
          [disabled]="atLimit()">
          Seleccionar
        </button>
      </div>

      @if (files().length > 0) {
        <ul class="files">
          @for (f of files(); track f.name + ':' + f.size; let i = $index) {
            <li class="file">
              <mat-icon class="ic">{{ iconFor(f.type) }}</mat-icon>
              <span class="name" [title]="f.name">{{ f.name }}</span>
              <span class="size">{{ humanSize(f.size) }}</span>
              <button
                mat-icon-button
                type="button"
                (click)="remove(i)"
                [attr.aria-label]="'Quitar ' + f.name">
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sap { display: flex; flex-direction: column; gap: .5rem; }
    .dropzone {
      display: flex; align-items: center; gap: .75rem;
      border: 1px dashed rgba(0,0,0,.18);
      border-radius: 10px;
      padding: .65rem .85rem;
      background: #fafafa;
      transition: background-color .18s, border-color .18s;
    }
    .dropzone.dragging,
    .dropzone:hover {
      border-color: rgba(25, 118, 210, .55);
      background: rgba(25, 118, 210, .04);
    }
    .dz-icon { color: rgba(0,0,0,.55); }
    .dz-copy { flex: 1; min-width: 0; }
    .dz-title { margin: 0; font-weight: 500; color: rgba(0,0,0,.78); font-size: .9rem; }
    .dz-hint  { margin: 0; font-size: .75rem; color: rgba(0,0,0,.55); }
    .files {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: .3rem;
    }
    .file {
      display: grid; grid-template-columns: 22px 1fr auto auto;
      gap: .5rem; align-items: center;
      padding: .35rem .55rem;
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 8px;
      background: #fff;
    }
    .ic   { color: rgba(0,0,0,.6); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; font-weight: 500; }
    .size { font-size: .72rem; color: rgba(0,0,0,.55); }
  `],
})
export class StagedAttachmentsPicker {
  readonly label = input<string>('Adjuntar archivos');
  readonly maxBytes = input<number>(ATTACHMENT_MAX_BYTES);
  readonly maxFiles = input<number>(5);
  readonly accept = input<string>('*/*');

  /** Lista controlada por el parent. */
  readonly files = input<File[]>([]);
  readonly filesChange = output<File[]>();

  private readonly toastr = inject(ToastService);

  readonly dragging = signal(false);

  readonly atLimit = computed(() => this.files().length >= this.maxFiles());
  readonly maxMb = computed(() => Math.round(this.maxBytes() / 1024 / 1024));

  onDragOver(ev: DragEvent): void { ev.preventDefault(); this.dragging.set(true); }
  onDragLeave(ev: DragEvent): void { ev.preventDefault(); this.dragging.set(false); }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging.set(false);
    if (!ev.dataTransfer?.files?.length) return;
    this.handleFiles(Array.from(ev.dataTransfer.files));
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  remove(index: number): void {
    const next = this.files().slice();
    next.splice(index, 1);
    this.filesChange.emit(next);
  }

  private handleFiles(incoming: File[]): void {
    const current = this.files();
    const room = this.maxFiles() - current.length;
    if (room <= 0) {
      this.toastr.error(`Máximo ${this.maxFiles()} archivos`);
      return;
    }
    const slice = incoming.slice(0, room);
    const accepted: File[] = [];
    for (const f of slice) {
      if (f.size > this.maxBytes()) {
        this.toastr.error(`"${f.name}" supera ${this.maxMb()} MB`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;
    this.filesChange.emit([...current, ...accepted]);
  }

  iconFor(mime: string): string {
    if (!mime) return 'attach_file';
    if (mime.startsWith('image/')) return 'image';
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
