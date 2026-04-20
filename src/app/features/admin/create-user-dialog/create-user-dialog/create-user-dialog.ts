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
    // alumno
    codigo_estudiante: [''],
    fecha_nacimiento: [null as Date | null],
    // docente
    especialidad: [''],
    titulo_profesional: [''],
    // padre
    relacion_familiar: [''],
    // admin
    cargo: [''],
  });

  onRolChange() {
    // limpiar campos específicos al cambiar rol
    this.form.patchValue({
      codigo_estudiante: '',
      fecha_nacimiento: null,
      especialidad: '',
      titulo_profesional: '',
      relacion_familiar: '',
      cargo: '',
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
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

    if (v.rol === 'alumno') {
      if (v.codigo_estudiante) payload.codigo_estudiante = v.codigo_estudiante;
      if (v.fecha_nacimiento) payload.fecha_nacimiento = (v.fecha_nacimiento as Date).toISOString().split('T')[0];
    }
    if (v.rol === 'docente') {
      if (v.especialidad) payload.especialidad = v.especialidad;
      if (v.titulo_profesional) payload.titulo_profesional = v.titulo_profesional;
    }
    if (v.rol === 'padre') {
      if (v.relacion_familiar) payload.relacion_familiar = v.relacion_familiar;
    }
    if (v.rol === 'admin') {
      if (v.cargo) payload.cargo = v.cargo;
    }

    this.api.post<User>('admin/users', payload).subscribe({
      next: r => {
        this.snack.open('Usuario creado correctamente', 'OK', { duration: 3000 });
        this.dialogRef.close(r.data);
        this.creating.set(false);
      },
      error: (err) => {
        this.snack.open(
          err?.error?.message ?? 'Error al crear usuario',
          'OK', { duration: 3000 }
        );
        this.creating.set(false);
      },
    });
  }
}