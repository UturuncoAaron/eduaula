import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth, CurrentUser } from '../../../core/auth/auth';

export type TipoDocumento = 'dni' | 'ce' | 'pasaporte';

interface TipoDocumentoOption {
  value: TipoDocumento;
  label: string;
  placeholder: string;
  maxLength: number;
}

interface UsuarioMock {
  id: string;
  name: string;
  role: CurrentUser['role'];
}

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);

  loading = signal(false);
  errorMsg = signal('');
  hidePassword = signal(true);

  readonly year = new Date().getFullYear();

  readonly features = [
    { icon: 'menu_book', label: 'Cursos y materiales digitales' },
    { icon: 'assignment', label: 'Exámenes y tareas en línea' },
    { icon: 'family_restroom', label: 'Portal para padres de familia' },
    { icon: 'videocam', label: 'Clases en vivo integradas' },
    { icon: 'grade', label: 'Seguimiento de notas bimestrales' },
  ];

  readonly tiposDocumento: TipoDocumentoOption[] = [
    { value: 'dni', label: 'DNI', placeholder: '12345678', maxLength: 8 },
    { value: 'ce', label: 'Carné de Extranjería', placeholder: 'CE123456', maxLength: 12 },
    { value: 'pasaporte', label: 'Pasaporte', placeholder: 'AB1234567', maxLength: 20 },
  ];

  // ── Mock temporal — eliminar cuando conectes la API ──────────────
  private readonly mockUsers: Record<string, UsuarioMock> = {
    '12345678': { id: 'u1', name: 'Carlos Quispe', role: 'alumno' },
    '87654321': { id: 'u2', name: 'María Torres', role: 'docente' },
    '00000001': { id: 'u3', name: 'Admin EduAula', role: 'admin' },
    '11223344': { id: 'u4', name: 'Roberto Mendoza', role: 'padre' },
  };
  // ────────────────────────────────────────────────────────────────

  get tipoSeleccionado(): TipoDocumentoOption {
    const val = this.form.get('tipo_documento')?.value as TipoDocumento;
    return this.tiposDocumento.find(t => t.value === val) ?? this.tiposDocumento[0];
  }

  form = this.fb.group({
    tipo_documento: ['dni' as TipoDocumento, Validators.required],
    numero_documento: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePassword() {
    this.hidePassword.update(v => !v);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    const { tipo_documento, numero_documento, password } = this.form.value;

    const payload = {
      tipo_documento: tipo_documento,
      numero_documento: numero_documento?.trim(),
      password: password,
    };

    // ── TODO: reemplazar mock por llamada real a la API ──────────────
    // this.apiService.post<{ user: CurrentUser; token: string }>('/auth/login', payload)
    //   .subscribe({
    //     next: ({ user, token }) => {
    //       this.auth.login({ ...user, token });
    //       this.router.navigate(['/dashboard']);
    //     },
    //     error: (err) => {
    //       this.errorMsg.set(err.error?.message ?? 'Credenciales incorrectas.');
    //       this.loading.set(false);
    //     },
    //   });
    // ────────────────────────────────────────────────────────────────

    // ── Mock temporal — eliminar cuando conectes la API ──────────────
    const usuario = this.mockUsers[payload.numero_documento ?? ''];

    if (usuario && payload.password === '123456') {
      this.auth.login({ ...usuario, token: 'fake-token' });
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMsg.set('Documento o contraseña incorrectos.');
      this.loading.set(false);
    }
    // ────────────────────────────────────────────────────────────────
  }
}