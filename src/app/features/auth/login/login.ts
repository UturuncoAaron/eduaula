import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required, Validators.minLength(6)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get maxLength(): number {
    const t = this.form.value.tipo_documento as string;
    return t === 'dni' ? 8 : t === 'ce' ? 12 : 20;
  }

  get docPlaceholder(): string {
    const t = this.form.value.tipo_documento as string;
    return t === 'dni' ? '8 dígitos' : t === 'ce' ? 'Hasta 12 caracteres' : 'Hasta 20 caracteres';
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  onDocTypeChange() {
    this.form.controls.numero_documento.reset('');
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.value as any).subscribe({
      next: () => {
        const user = this.auth.currentUser();

        if (!user || !user.rol) {
          this.error.set('Error de integridad: Cuenta sin rol asignado.');
          this.loading.set(false);
          this.auth.logout();
          return;
        }

        // Redirección escalable
        switch (user.rol) {
          case 'alumno': this.router.navigate(['/dashboard/alumno']); break;
          case 'docente': this.router.navigate(['/dashboard/docente']); break;
          case 'padre': this.router.navigate(['/dashboard/padre']); break;
          case 'admin': this.router.navigate(['/dashboard/admin']); break;
          default:
            this.error.set('Rol no reconocido por el sistema');
            this.loading.set(false);
            this.auth.logout();
            break;
        }
      },
      error: (msg: string) => {
        this.error.set(msg || 'Documento o contraseña incorrectos');
        this.loading.set(false);
      }
    });
  }
}