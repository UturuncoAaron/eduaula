import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../shared/components/loading-skeleton/loading-skeleton';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';

interface Announcement {
  id: string;
  titulo: string;
  contenido: string;
  destinatario: 'todos' | 'alumnos' | 'docentes' | 'padres';
  created_at: string;
  autor?: { id: string; nombre?: string; email?: string };
}

@Component({
  selector: 'app-announcements-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatDialogModule, MatSnackBarModule,
    PageHeader, EmptyState, LoadingSkeleton,
  ],
  templateUrl: './announcements-admin.html',
  styleUrl: './announcements-admin.scss',
})
export class AnnouncementsAdmin implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  list = signal<Announcement[]>([]);
  loading = signal(true);
  saving = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    contenido: ['', Validators.required],
    destinatario: ['todos' as 'todos' | 'alumnos' | 'docentes' | 'padres'],
  });

  ngOnInit() { this.cargar(); }

  private cargar() {
    this.loading.set(true);
    this.api.get<Announcement[]>('announcements').subscribe({
      next: r => { this.list.set(r.data); this.loading.set(false); },
      error: () => { this.list.set([]); this.loading.set(false); },
    });
  }

  publicar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.api.post<Announcement>('announcements', this.form.value).subscribe({
      next: () => {
        this.snack.open('Comunicado publicado', 'OK', { duration: 2500 });
        this.form.reset({ titulo: '', contenido: '', destinatario: 'todos' });
        this.saving.set(false);
        this.cargar();
      },
      error: () => {
        this.snack.open('No se pudo publicar el comunicado', 'OK', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  eliminar(a: Announcement) {
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar comunicado', message: `¿Eliminar "${a.titulo}"?`, confirmText: 'Eliminar' },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.delete(`announcements/${a.id}`).subscribe({
        next: () => {
          this.snack.open('Comunicado eliminado', 'OK', { duration: 2500 });
          this.cargar();
        },
        error: () => this.snack.open('Error al eliminar', 'OK', { duration: 3000 }),
      });
    });
  }
}
