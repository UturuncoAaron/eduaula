import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../../core/services/api';
import { User } from '../../../../core/models/user';

@Component({
  selector: 'app-create-user-dialog',
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

  creating = signal(false);
  showPass = signal(false);

  form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_materno: [''],
    email: ['', Validators.email],
    telefono: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rol: ['alumno', Validators.required],
    codigo_estudiante: [''],
    fecha_nacimiento: [null as Date | null],
    especialidad: [''],
    titulo_profesional: [''],
    relacion: [''],
    cargo: [''],
  });

  onRolChange() {
    this.form.patchValue({
      codigo_estudiante: '',
      fecha_nacimiento: null,
      especialidad: '',
      titulo_profesional: '',
      relacion: '',
      cargo: '',
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);

    const v = this.form.value;

    const payload: any = {
      tipo_documento: v.tipo_documento,
      numero_documento: v.numero_documento,
      nombre: v.nombre,
      apellido_paterno: v.apellido_paterno,
      apellido_materno: v.apellido_materno || undefined,
      email: v.email || undefined,
      telefono: v.telefono || undefined,
      password: v.password,
      rol: v.rol,
    };

    switch (v.rol) {
     case 'alumno':
        payload.codigo_estudiante = v.codigo_estudiante?.trim() ? v.codigo_estudiante : `EST-${v.numero_documento}`;
        
        if (v.fecha_nacimiento) payload.fecha_nacimiento = (v.fecha_nacimiento as Date).toISOString().split('T')[0];
        break;
      case 'docente':
        if (v.especialidad) payload.especialidad = v.especialidad;
        if (v.titulo_profesional) payload.titulo_profesional = v.titulo_profesional;
        break;
      case 'padre':
        if (v.relacion) payload.relacion = v.relacion;
        break;
      case 'admin':
        if (v.cargo) payload.cargo = v.cargo;
        break;
    }

    const roleEndpoints: Record<string, string> = {
      alumno: 'admin/users/alumnos',
      docente: 'admin/users/docentes',
      padre: 'admin/users/padres',
      admin: 'admin/users/admins'
    };

    const targetEndpoint = roleEndpoints[v.rol as string];

    this.api.post<User>(targetEndpoint, payload).subscribe({
      next: r => {
        this.snack.open('Usuario creado exitosamente', 'Cerrar', { duration: 3000, panelClass: 'success-snackbar' });
        this.dialogRef.close(r.data);
        this.creating.set(false);
      },
      error: (err) => {
        this.snack.open(
          err?.error?.message ?? 'Error de integridad al crear usuario',
          'Cerrar', { duration: 4000 }
        );
        this.creating.set(false);
      },
    });
  }
}