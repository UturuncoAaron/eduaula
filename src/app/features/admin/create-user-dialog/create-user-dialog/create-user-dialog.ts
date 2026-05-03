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
import { UserRole } from '../../../../shared/components/sidebar/navigation.config';

export interface CreateUserDialogData { rol: UserRole; }

interface RoleMeta {
  label: string;
  icon: string;
  endpoint: string;
  color: string;
}

const ROLE_META: Record<UserRole, RoleMeta> = {
  admin: { label: 'Administrador', icon: 'admin_panel_settings', endpoint: 'admin/users/admins', color: '#ef4444' },
  alumno: { label: 'Alumno', icon: 'school', endpoint: 'admin/users/alumnos', color: '#10b981' },
  docente: { label: 'Docente', icon: 'badge', endpoint: 'admin/users/docentes', color: '#f59e0b' },
  padre: { label: 'Padre / Tutor', icon: 'family_restroom', endpoint: 'admin/users/padres', color: '#8b5cf6' },
  psicologa: { label: 'Psicóloga', icon: 'psychology', endpoint: 'admin/users/psicologos', color: '#0ea5e9' },
};

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule, MatDialogModule,
  ],
  templateUrl: './create-user-dialog.html',
  styleUrl: './create-user-dialog.scss',
})
export class CreateUserDialog {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<CreateUserDialog>);

  data = inject<CreateUserDialogData>(MAT_DIALOG_DATA);
  creating = signal(false);
  roleMeta = computed<RoleMeta>(() => ROLE_META[this.data.rol]);

  // fecha_nacimiento requerida solo para alumnos
  readonly fechaRequerida = this.data.rol === 'alumno';

  form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_materno: [''],
    email: ['', Validators.email],
    telefono: [''],
    fecha_nacimiento: [null as Date | null, this.fechaRequerida ? Validators.required : null],
    // Docente
    especialidad: [''],
    titulo_profesional: [''],
    tipo_contrato: ['contratado'],
    estado_contrato: ['activo'],
    fecha_inicio_contrato: [null as Date | null],
    fecha_fin_contrato: [null as Date | null],
    // Padre
    relacion: ['', this.data.rol === 'padre' ? Validators.required : null],
    // Admin
    cargo: [''],
    // Psicóloga
    colegiatura: [''],
  });

  // Mostrar fecha_fin solo si tipo_contrato = 'contratado'
  esContratado = computed(() =>
    this.form.get('tipo_contrato')?.value === 'contratado'
  );

  progressWidth = computed(() => {
    const c = this.form.controls;
    const required = [c.tipo_documento, c.numero_documento, c.nombre, c.apellido_paterno];
    const optional = [c.apellido_materno, c.email, c.telefono];
    const filledReq = required.filter(x => x.value?.toString().trim()).length;
    const filledOpt = optional.filter(x => x.value?.toString().trim()).length;
    const total = ((filledReq / required.length) * 70) + ((filledOpt / optional.length) * 30);
    return `${Math.round(total)}%`;
  });

  private toISODate(d: Date | null): string | null {
    return d ? d.toISOString().split('T')[0] : null;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
      ...(v.fecha_nacimiento && { fecha_nacimiento: this.toISODate(v.fecha_nacimiento as Date) }),
    };

    const extras: Record<UserRole, Record<string, unknown>> = {
      alumno: {},  // fecha_nacimiento ya va en base (requerida)

      docente: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.titulo_profesional?.trim() && { titulo_profesional: v.titulo_profesional }),
        tipo_contrato: v.tipo_contrato,
        estado_contrato: v.estado_contrato,
        ...(v.fecha_inicio_contrato && { fecha_inicio_contrato: this.toISODate(v.fecha_inicio_contrato as Date) }),
        ...(v.fecha_fin_contrato && { fecha_fin_contrato: this.toISODate(v.fecha_fin_contrato as Date) }),
      },

      padre: { relacion: v.relacion },

      admin: {
        ...(v.cargo?.trim() && { cargo: v.cargo }),
      },

      psicologa: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.colegiatura?.trim() && { colegiatura: v.colegiatura }),
      },
    };

    this.api.post(endpoint, { ...base, ...extras[this.data.rol] }).subscribe({
      next: () => {
        this.toastr.success('Usuario registrado correctamente', '¡Listo!');
        this.dialogRef.close(true);
        this.creating.set(false);
      },
      error: (err) => {
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : (err?.error?.message ?? 'Error al crear el usuario');
        this.toastr.error(msg, 'Error');
        this.creating.set(false);
      },
    });
  }
}