import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { StagedAttachmentsPicker } from '../../../shared/components/staged-attachments-picker/staged-attachments-picker';
import { AttachmentsService, ATTACHMENT_MAX_BYTES } from '../../../core/services/attachments';

type Destinatario = 'todos' | 'alumnos' | 'docentes' | 'padres' | 'psicologas';

interface Announcement {
  id: string;
  titulo: string;
  contenido: string;
  destinatarios: Destinatario[];
  created_at: string;
  admin?: { nombre: string; apellido_paterno: string };
}

const LABELS: Record<Destinatario, string> = {
  todos: 'Todos', alumnos: 'Alumnos', docentes: 'Docentes',
  padres: 'Padres', psicologas: 'Psicólogas',
};

@Component({
  selector: 'app-announcements-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatButtonModule, MatIconModule,
    MatDialogModule, MatTooltipModule,
    StagedAttachmentsPicker,
  ],
  templateUrl: './announcements-admin.html',
  styleUrl: './announcements-admin.scss',
})
export class AnnouncementsAdmin implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private attachments = inject(AttachmentsService);

  list = signal<Announcement[]>([]);
  loading = signal(true);
  saving = signal(false);

  stagedFiles = signal<File[]>([]);
  readonly maxFileBytes = ATTACHMENT_MAX_BYTES;
  readonly maxFiles = 5;

  titleFocused = false;
  contentFocused = false;

  destOptions: { value: Destinatario; label: string; icon: string }[] = [
    { value: 'todos', label: 'Todos', icon: 'groups' },
    { value: 'alumnos', label: 'Alumnos', icon: 'school' },
    { value: 'docentes', label: 'Docentes', icon: 'badge' },
    { value: 'padres', label: 'Padres', icon: 'family_restroom' },
    { value: 'psicologas', label: 'Psicólogas', icon: 'psychology' },
  ];

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    contenido: ['', Validators.required],
    destinatarios: [['todos'] as Destinatario[], Validators.required],
  });

  selectedDests = computed<Destinatario[]>(() =>
    (this.form.get('destinatarios')?.value as Destinatario[]) ?? []
  );

  labelDest(d: string): string { return LABELS[d as Destinatario] ?? d; }

  isDestSelected(value: Destinatario): boolean {
    return ((this.form.get('destinatarios')?.value as Destinatario[]) ?? []).includes(value);
  }

  toggleDest(value: Destinatario): void {
    const current = [...((this.form.get('destinatarios')?.value as Destinatario[]) ?? [])];
    if (value === 'todos') {
      this.form.get('destinatarios')?.setValue(current.includes('todos') ? [] : ['todos']);
      return;
    }
    const sinTodos = current.filter(d => d !== 'todos');
    const idx = sinTodos.indexOf(value);
    idx >= 0 ? sinTodos.splice(idx, 1) : sinTodos.push(value);
    this.form.get('destinatarios')?.setValue(sinTodos);
  }

  ngOnInit() { this.cargar(); }

  private cargar() {
    this.loading.set(true);
    this.api.get<Announcement[]>('announcements').subscribe({
      next: r => { this.list.set((r as any).data ?? []); this.loading.set(false); },
      error: () => { this.list.set([]); this.loading.set(false); },
    });
  }

  publicar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const dests = this.form.get('destinatarios')?.value as Destinatario[];
    if (!dests?.length) { this.toastr.error('Selecciona al menos un destinatario', 'Error'); return; }
    this.saving.set(true);
    this.api.post<Announcement>('announcements', this.form.value).subscribe({
      next: r => {
        const newId = r.data?.id;
        const files = this.stagedFiles();
        if (newId && files.length > 0) {
          // Sube cada archivo al comunicado recién creado; reportamos fallos parciales.
          forkJoin(
            files.map(f =>
              this.attachments.upload(f, 'announcement', newId).pipe(catchError(() => of(null))),
            ),
          ).subscribe({
            next: results => {
              const failures = results.filter(x => x === null).length;
              if (failures > 0) {
                this.toastr.error(`No se pudieron subir ${failures} archivo(s)`);
              } else {
                this.toastr.success('Comunicado publicado', 'Éxito');
              }
              this.finishPublicar();
            },
          });
        } else {
          this.toastr.success('Comunicado publicado', 'Éxito');
          this.finishPublicar();
        }
      },
      error: () => { this.toastr.error('No se pudo publicar', 'Error'); this.saving.set(false); },
    });
  }

  private finishPublicar(): void {
    this.form.reset({ titulo: '', contenido: '', destinatarios: ['todos'] });
    this.stagedFiles.set([]);
    this.saving.set(false);
    this.cargar();
  }

  eliminar(a: Announcement) {
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar comunicado', message: `¿Eliminar "${a.titulo}"?`, confirm: 'Eliminar', danger: true },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.delete(`announcements/${a.id}`).subscribe({
        next: () => { this.toastr.success('Eliminado', 'Éxito'); this.cargar(); },
        error: () => this.toastr.error('Error al eliminar', 'Error'),
      });
    });
  }
}