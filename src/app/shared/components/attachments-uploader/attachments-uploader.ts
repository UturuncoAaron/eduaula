import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import {
  AttachmentsService,
  AttachmentDto,
  AttachmentOwnerType,
  ATTACHMENT_MAX_BYTES,
} from '../../../core/services/attachments';

const MAX_PER_OWNER = 5;

@Component({
  selector: 'app-attachments-uploader',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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

      <mat-icon class="dz-icon">cloud_upload</mat-icon>
      <p class="dz-title">Arrastra archivos o haz clic para seleccionar</p>
      <p class="dz-hint">
        Máx {{ maxMb() }} MB por archivo · Hasta {{ maxFiles() }} archivos
      </p>

      <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading() || atLimit()">
        <mat-icon>attach_file</mat-icon>
        Seleccionar archivos
      </button>
    </div>

    @if (uploading()) {
      <p class="status">Subiendo {{ uploading() }} archivo(s)...</p>
    }

    @if (items().length > 0) {
      <ul class="files">
        @for (it of items(); track it.id) {
          <li class="file">
            <mat-icon class="ic">{{ iconFor(it.mime_type) }}</mat-icon>
            <span class="name">{{ it.original_name }}</span>
            <span class="size">{{ humanSize(it.size_bytes) }}</span>
            <button mat-icon-button type="button" (click)="onRemove(it)" [attr.aria-label]="'Quitar ' + it.original_name">
              <mat-icon>close</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .dropzone {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: .5rem;
      border: 2px dashed rgba(0,0,0,.15);
      border-radius: 12px;
      padding: 1.25rem 1rem;
      transition: border-color .2s, background-color .2s;
      cursor: pointer;
      background: #fafafa;
    }
    .dropzone:hover, .dropzone.dragging {
      border-color: var(--mat-primary, #1976d2);
      background: rgba(25, 118, 210, .04);
    }
    .dz-icon { font-size: 36px; height: 36px; width: 36px; color: rgba(0,0,0,.55); }
    .dz-title { margin: 0; font-weight: 500; color: rgba(0,0,0,.75); }
    .dz-hint { margin: 0; font-size: .8rem; color: rgba(0,0,0,.55); }
    .status { font-size: .85rem; color: rgba(0,0,0,.6); margin: .5rem 0 0; }
    .files { list-style: none; padding: 0; margin: .75rem 0 0; display: flex; flex-direction: column; gap: .35rem; }
    .file { display: grid; grid-template-columns: 24px 1fr auto auto; gap: .5rem; align-items: center;
      padding: .35rem .5rem; border: 1px solid rgba(0,0,0,.08); border-radius: 8px; background: #fff; }
    .ic { color: rgba(0,0,0,.6); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .size { font-size: .75rem; color: rgba(0,0,0,.55); }
  `],
})
export class AttachmentsUploader {
  readonly ownerType = input.required<AttachmentOwnerType>();
  readonly ownerId = input.required<string>();
  readonly accept = input<string>('*/*');
  readonly maxBytes = input<number>(ATTACHMENT_MAX_BYTES);
  readonly maxFiles = input<number>(MAX_PER_OWNER);
  readonly existing = input<AttachmentDto[]>([]);

  readonly added = output<AttachmentDto>();
  readonly removed = output<string>();

  private readonly api = inject(AttachmentsService);
  private readonly toastr = inject(ToastService);

  readonly localItems = signal<AttachmentDto[]>([]);
  readonly uploading = signal<number>(0);
  readonly dragging = signal<boolean>(false);

  readonly items = computed(() => [...this.existing(), ...this.localItems()]);
  readonly atLimit = computed(() => this.items().length >= this.maxFiles());
  readonly maxMb = computed(() => Math.round(this.maxBytes() / 1024 / 1024));

  iconFor(mime: string): string {
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

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    if (!ev.dataTransfer?.files?.length) return;
    this.handleFiles(Array.from(ev.dataTransfer.files));
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  private handleFiles(files: File[]) {
    const room = this.maxFiles() - this.items().length;
    if (room <= 0) {
      this.toastr.error(`Máximo ${this.maxFiles()} archivos`);
      return;
    }
    const slice = files.slice(0, room);
    for (const f of slice) {
      if (f.size > this.maxBytes()) {
        this.toastr.error(`"${f.name}" supera ${this.maxBytes() / 1024 / 1024} MB`);
        continue;
      }
      this.uploading.update(n => n + 1);
      this.api.upload(f, this.ownerType(), this.ownerId()).subscribe({
        next: dto => {
          this.uploading.update(n => Math.max(0, n - 1));
          if (!dto) {
            this.toastr.error(`No se pudo subir "${f.name}"`);
            return;
          }
          this.localItems.update(list => [...list, dto]);
          this.added.emit(dto);
        },
        error: () => {
          this.uploading.update(n => Math.max(0, n - 1));
          this.toastr.error(`Error subiendo "${f.name}"`);
        },
      });
    }
  }

  onRemove(it: AttachmentDto) {
    this.api.remove(it.id).subscribe(ok => {
      if (!ok) {
        this.toastr.error('No se pudo eliminar el adjunto');
        return;
      }
      this.localItems.update(list => list.filter(x => x.id !== it.id));
      this.removed.emit(it.id);
    });
  }
}
