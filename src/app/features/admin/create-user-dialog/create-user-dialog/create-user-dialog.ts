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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
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
};

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatSnackBarModule, MatDialogModule,
  ],
  templateUrl: './create-user-dialog.html',
  styleUrl: './create-user-dialog.scss',
})
export class CreateUserDialog {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CreateUserDialog>);

  /** Rol recibido desde el tab activo */
  data: CreateUserDialogData = inject(MAT_DIALOG_DATA);

  creating = signal(false);
  showPass = signal(false);

  /** Metadatos reactivos según el rol */
  roleMeta = computed<RoleMeta>(() => ROLE_META[this.data.rol]);

  form = this.fb.group({
    // ── Campos comunes ──────────────────────────────────────────
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_materno: [''],
    email: ['', Validators.email],
    telefono: [''],

    // ── Campos por rol ──────────────────────────────────────────
    // alumno
    codigo_estudiante: [''],
    fecha_nacimiento: [null as Date | null],

    // docente
    especialidad: [''],
    titulo_profesional: [''],

    // padre
    relacion: [''],

    // admin
    cargo: [''],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    const v = this.form.value;

    // ── Payload base (campos comunes a todos los roles) ─────────
    const base: Record<string, unknown> = {
      tipo_documento: v.tipo_documento,
      numero_documento: v.numero_documento,
      password: v.password,
      nombre: v.nombre,
      apellido_paterno: v.apellido_paterno,
      ...(v.apellido_materno?.trim() && { apellido_materno: v.apellido_materno }),
      ...(v.email?.trim() && { email: v.email }),
      ...(v.telefono?.trim() && { telefono: v.telefono }),
    };

    // ── Campos extra según rol ──────────────────────────────────
    const extras: Record<UserRole, Record<string, unknown>> = {
      alumno: {
        codigo_estudiante: v.codigo_estudiante?.trim()
          ? v.codigo_estudiante
          : `EST-${v.numero_documento}`,
        ...(v.fecha_nacimiento && {
          fecha_nacimiento: (v.fecha_nacimiento as Date).toISOString().split('T')[0],
        }),
      },
      docente: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.titulo_profesional?.trim() && { titulo_profesional: v.titulo_profesional }),
      },
      padre: {
        ...(v.relacion && { relacion: v.relacion }),
      },
      admin: {
        ...(v.cargo?.trim() && { cargo: v.cargo }),
      },
    };

    const payload = { ...base, ...extras[this.data.rol] };
    const endpoint = ROLE_META[this.data.rol].endpoint;

    this.api.post(endpoint, payload).subscribe({
      next: () => {
        this.snack.open('Usuario creado exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: 'success-snackbar',
        });
        this.dialogRef.close(true); // true = se creó algo, recargar
        this.creating.set(false);
      },
      error: (err) => {
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : (err?.error?.message ?? 'Error al crear usuario');
        this.snack.open(msg, 'Cerrar', { duration: 5000 });
        this.creating.set(false);
      },
    });
  }
}