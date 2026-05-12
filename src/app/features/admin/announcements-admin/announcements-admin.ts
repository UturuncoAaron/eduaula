import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';

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
  ],
  templateUrl: './announcements-admin.html',
  styleUrl: './announcements-admin.scss',
})
export class AnnouncementsAdmin implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  list = signal<Announcement[]>([]);
  loading = signal(true);
  saving = signal(false);

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
      next: () => {
        this.toastr.success('Comunicado publicado', 'Éxito');
        this.form.reset({ titulo: '', contenido: '', destinatarios: ['todos'] });
        this.saving.set(false);
        this.cargar();
      },
      error: () => { this.toastr.error('No se pudo publicar', 'Error'); this.saving.set(false); },
    });
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