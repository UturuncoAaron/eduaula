import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../../core/services/api';
import { User } from '../../../../core/models/user';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DocTypePipe } from '../../../../shared/pipes/doc-type-pipe';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatTableModule, MatCardModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule,
    MatSnackBarModule, MatChipsModule, PageHeader, DocTypePipe,
    TitleCasePipe,
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  users = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  cols = ['nombre', 'documento', 'rol', 'estado', 'acciones'];

  form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.minLength(6)]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido_paterno: ['', [Validators.required, Validators.minLength(2)]],
    apellido_materno: [''],
    email: ['', Validators.email],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rol: ['alumno', Validators.required],
  });

  ngOnInit() {
    this.api.get<User[]>('admin/users').subscribe({
      next: r => { this.users.set(r.data); this.loading.set(false); },
      error: () => {
        this.users.set([
          { id: '1', tipo_documento: 'dni', numero_documento: '12345678', nombre: 'Carlos', apellido_paterno: 'García', rol: 'alumno', activo: true },
          { id: '2', tipo_documento: 'dni', numero_documento: '87654321', nombre: 'Prof. María', apellido_paterno: 'López', rol: 'docente', activo: true },
          { id: '3', tipo_documento: 'dni', numero_documento: '11111111', nombre: 'Admin', apellido_paterno: 'Sistema', rol: 'admin', activo: true },
        ]);
        this.loading.set(false);
      },
    });
  }

  createUser() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.api.post<User>('admin/users', this.form.value).subscribe({
      next: r => {
        this.users.update(u => [r.data, ...u]);
        this.form.reset({ tipo_documento: 'dni', rol: 'alumno' });
        this.showForm.set(false);
        this.snack.open('Usuario creado correctamente', 'OK', { duration: 3000 });
      },
      error: () => this.snack.open('Error al crear usuario', 'OK', { duration: 3000 }),
    });
  }

  toggleActive(user: any) {
    this.api.patch(`admin/users/${user.id}`, { activo: !user.activo }).subscribe({
      next: () => {
        this.users.update(list =>
          list.map(u => u.id === user.id ? { ...u, activo: !u.activo } : u)
        );
      },
      error: () => this.snack.open('Error al actualizar', 'OK', { duration: 2000 }),
    });
  }
}