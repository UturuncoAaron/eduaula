import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../../core/auth/auth';

@Component({
    selector: 'app-form-panel',
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './form-panel.html',
    styleUrl: './form-panel.scss',
})
export class FormPanel {
    private fb = inject(FormBuilder);
    private auth = inject(AuthService);
    private router = inject(Router);

    loading = signal(false);
    error = signal('');
    showPassword = signal(false);

    form = this.fb.group({
        codigo_acceso: ['', [Validators.required, Validators.minLength(5)]],
        password: ['', [Validators.required, Validators.minLength(4)]],
    });

    togglePassword() {
        this.showPassword.update(v => !v);
    }

    submit() {
        if (this.form.invalid) return;
        this.loading.set(true);
        this.error.set('');

        this.auth.login(this.form.value as any).subscribe({
            next: () => {
                const user = this.auth.currentUser();
                if (!user?.rol) {
                    this.error.set('Error: cuenta sin rol asignado.');
                    this.loading.set(false);
                    this.auth.logout();
                    return;
                }
                this.redirectByRole(user.rol);
            },
            error: (msg: string) => {
                this.error.set(msg || 'Código de acceso o contraseña incorrectos');
                this.loading.set(false);
            },
        });
    }

    private redirectByRole(rol: string) {
        const routes: Record<string, string> = {
            alumno: '/dashboard/alumno',
            docente: '/dashboard/docente',
            padre: '/dashboard/padre',
            admin: '/dashboard/admin',
            psicologa: '/dashboard/psicologa',
            auxiliar: '/dashboard/auxiliar',
        };
        const route = routes[rol];
        if (route) {
            this.router.navigate([route]);
        } else {
            this.error.set('Rol no reconocido');
            this.auth.logout();
        }
    }
}