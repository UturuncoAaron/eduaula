import {
  Component, inject, signal, computed, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { StagedAttachmentsPicker } from '../staged-attachments-picker/staged-attachments-picker';
import { AttachmentsService, ATTACHMENT_MAX_BYTES } from '../../../core/services/attachments';

type Destinatario = 'todos' | 'alumnos' | 'docentes' | 'padres' | 'psicologas';

interface Announcement {
  id: string;
  titulo: string;
  contenido: string;
  destinatarios: Destinatario[];
  created_at: string;
  autor?: { nombre: string; apellido_paterno: string; rol?: string };
}

const LABELS: Record<Destinatario, string> = {
  todos: 'Todos', alumnos: 'Alumnos', docentes: 'Docentes',
  padres: 'Padres', psicologas: 'Psicólogas',
};

@Component({
  selector: 'app-announcements-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatIconModule, MatDialogModule, MatTooltipModule,
    StagedAttachmentsPicker,
  ],
  templateUrl: './announcements-page.html',
  styleUrl: './announcements-page.scss',
})
export class AnnouncementsPage implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private attachments = inject(AttachmentsService);

  list = signal<Announcement[]>([]);
  loading = signal(true);
  saving = signal(false);
  checkingPermiso = signal(true);
  tienePermiso = signal(false);

  stagedFiles = signal<File[]>([]);
  readonly maxFileBytes = ATTACHMENT_MAX_BYTES;
  readonly maxFiles = 5;

  titleFocused = false;
  contentFocused = false;

  private get rol() { return this.auth.currentUser()?.rol; }
  private get userId() { return this.auth.currentUser()?.id; }

  // Admin siempre puede; otros roles necesitan permiso explícito
  canCreate = computed(() => {
    if (this.rol === 'admin') return true;
    return !this.checkingPermiso() && this.tienePermiso();
  });

  canDelete = computed(() => this.rol === 'admin');

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

  ngOnInit() {
    this.verificarPermiso();
    this.cargar();
  }

  private verificarPermiso() {
    if (this.rol === 'admin') {
      this.tienePermiso.set(true);
      this.checkingPermiso.set(false);
      return;
    }
    if (!this.userId) {
      this.checkingPermiso.set(false);
      return;
    }
    this.api.get<{ tiene: boolean }>(
      `permissions/check/${this.userId}/comunicados/crear`
    ).subscribe({
      next: r => {
        this.tienePermiso.set((r as any).data?.tiene ?? false);
        this.checkingPermiso.set(false);
      },
      error: () => this.checkingPermiso.set(false),
    });
  }

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
        const newId = (r as any).data?.id;
        const files = this.stagedFiles();
        if (newId && files.length > 0) {
          forkJoin(
            files.map(f =>
              this.attachments.upload(f, 'announcement', newId).pipe(catchError(() => of(null)))
            )
          ).subscribe({
            next: results => {
              const failures = results.filter(x => x === null).length;
              if (failures > 0) this.toastr.error(`No se pudieron subir ${failures} archivo(s)`);
              else this.toastr.success('Comunicado publicado', 'Éxito');
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
      data: {
        title: 'Eliminar comunicado',
        message: `¿Eliminar "${a.titulo}"?`,
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
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