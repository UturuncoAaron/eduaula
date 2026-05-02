import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../core/services/api';
// Asegúrate de agregar 'psicologa' a tu type UserRole en navigation.config.ts
import { UserRole } from '../../../../shared/components/sidebar/navigation.config';

export interface CreateUserDialogData {
  rol: UserRole;
}

interface RoleMeta {
  label: string;
  icon: string;
  endpoint: string;
}

const ROLE_META: Record<UserRole, RoleMeta> = {
  admin: { label: 'Administrador del Sistema', icon: 'admin_panel_settings', endpoint: 'admin/users/admins' },
  alumno: { label: 'Alumno Regular', icon: 'school', endpoint: 'admin/users/alumnos' },
  docente: { label: 'Docente / Profesor', icon: 'badge', endpoint: 'admin/users/docentes' },
  padre: { label: 'Padre / Tutor / Apoderado', icon: 'family_restroom', endpoint: 'admin/users/padres' },
  psicologa: { label: 'Psicóloga', icon: 'psychology', endpoint: 'admin/users/psicologos' },
};

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatDialogModule,
  ],
  templateUrl: './create-user-dialog.html',
  styleUrl: './create-user-dialog.scss',
})
export class CreateUserDialog {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<CreateUserDialog>);

  data: CreateUserDialogData = inject(MAT_DIALOG_DATA);
  creating = signal(false);
  roleMeta = computed<RoleMeta>(() => ROLE_META[this.data.rol]);

  form = this.fb.group({
    // ── Campos comunes (CONTRASEÑA ELIMINADA) ───────────────────
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_materno: [''],
    email: ['', Validators.email],
    telefono: [''],

    // ── Campos por rol ──────────────────────────────────────────
    codigo_estudiante: [''],
    fecha_nacimiento: [null as Date | null],
    especialidad: [''], // Compartido por Docente y Psicóloga
    colegiatura: [''],
    titulo_profesional: [''],
    relacion: [''],
    cargo: [''],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.data.rol === 'padre' && !this.form.value.relacion) {
      this.toastr.error('Debes indicar la relación con el alumno', 'Error');
      return;
    }

    this.creating.set(true);
    const v = this.form.value;
    const endpoint = ROLE_META[this.data.rol].endpoint;

    const base: Record<string, unknown> = {
      tipo_documento: v.tipo_documento,
      numero_documento: v.numero_documento,
      nombre: v.nombre,
      apellido_paterno: v.apellido_paterno,
      ...(v.apellido_materno?.trim() && { apellido_materno: v.apellido_materno }),
      ...(v.email?.trim() && { email: v.email }),
      ...(v.telefono?.trim() && { telefono: v.telefono }),
    };

    const extras: Record<string, Record<string, unknown>> = {
      alumno: {
        codigo_estudiante: v.codigo_estudiante?.trim() ? v.codigo_estudiante : `EST-${v.numero_documento}`,
        ...(v.fecha_nacimiento && { fecha_nacimiento: (v.fecha_nacimiento as Date).toISOString().split('T')[0] }),
      },
      docente: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.titulo_profesional?.trim() && { titulo_profesional: v.titulo_profesional }),
      },
      padre: { ...(v.relacion && { relacion: v.relacion }) },
      admin: { ...(v.cargo?.trim() && { cargo: v.cargo }) },
      psicologa: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.colegiatura?.trim() && { colegiatura: v.colegiatura }),
      },
    };

    const payload = { ...base, ...extras[this.data.rol] };
    this.executePost(endpoint, payload);
  }

  // Helper para no repetir el subscribe
  private executePost(endpoint: string, payload: any) {
    this.api.post(endpoint, payload).subscribe({
      next: () => {
        this.toastr.success('Registro creado correctamente', 'Éxito');
        this.dialogRef.close(true);
        this.creating.set(false);
      },
      error: (err) => {
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : (err?.error?.message ?? 'Ocurrió un error, intenta nuevamente');
        this.toastr.error(msg, 'Error');
        this.creating.set(false);
      },
    });
  }
}