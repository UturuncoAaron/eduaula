import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { LoadingSkeleton } from '../../../shared/components/loading-skeleton/loading-skeleton';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';

type Tipo = 'alumnos' | 'docentes' | 'padres' | 'admins';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatChipsModule, MatDividerModule,
    MatDialogModule, PageHeader, LoadingSkeleton,
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  tipo = signal<Tipo>('alumnos');
  id = signal<string>('');
  loading = signal(true);
  user = signal<any>(null);
  saving = signal(false);

  resetForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit() {
    this.tipo.set(this.route.snapshot.paramMap.get('tipo') as Tipo);
    this.id.set(this.route.snapshot.paramMap.get('id')!);
    this.cargar();
  }

  private cargar() {
    this.loading.set(true);
    this.api.get<any>(`admin/users/${this.tipo()}/${this.id()}`).subscribe({
      next: r => { this.user.set(r.data); this.loading.set(false); },
      error: () => {
        this.toastr.error('Usuario no encontrado', 'Error');
        this.loading.set(false);
        this.router.navigate(['/admin/usuarios']);
      },
    });
  }

  resetPassword() {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.api.patch(`admin/users/${this.id()}/reset-password`, this.resetForm.value).subscribe({
      next: () => {
        this.toastr.success('Contraseña actualizada', 'Éxito');
        this.resetForm.reset({ newPassword: '' });
        this.saving.set(false);
      },
      error: () => {
        this.toastr.error('Error al actualizar contraseña', 'Error');
        this.saving.set(false);
      },
    });
  }

  desactivar() {
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Desactivar usuario', message: '¿Confirmas la desactivación? El usuario no podrá iniciar sesión.', confirmText: 'Desactivar' },
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.delete(`admin/users/${this.id()}`).subscribe({
        next: () => {
          this.toastr.success('Usuario desactivado', 'Éxito');
          this.cargar();
        },
        error: () => this.toastr.error('Error al desactivar', 'Error'),
      });
    });
  }

  reactivar() {
    this.api.patch(`admin/users/${this.id()}/reactivar`, {}).subscribe({
      next: () => {
        this.toastr.success('Usuario reactivado', 'Éxito');
        this.cargar();
      },
      error: () => this.toastr.error('Error al reactivar', 'Error'),
    });
  }

  get nombreCompleto(): string {
    const u = this.user();
    if (!u) return '';
    return [u.nombre, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' ');
  }

  get isActive(): boolean {
    return this.user()?.cuenta?.activo ?? this.user()?.activo ?? true;
  }
}
