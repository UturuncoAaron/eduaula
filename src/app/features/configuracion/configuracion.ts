import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth';
import { ApiService } from '../../core/services/api';
import { UserRole } from '../../shared/components/sidebar/navigation.config';

@Component({
    selector: 'app-configuracion',
    standalone: true,
    imports: [FormsModule, MatIconModule],
    templateUrl: './configuracion.html',
    styleUrl: './configuracion.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionComponent implements OnInit {
    private auth = inject(AuthService);
    private api = inject(ApiService);

    user = this.auth.currentUser;

    // ── Foto ──────────────────────────────────────────────────
    fotoFile = signal<File | null>(null);
    fotoPreview = signal<string | null>(null);
    uploadingFoto = signal(false);
    fotoSuccess = signal(false);
    fotoError = signal('');

    // ── Info personal ─────────────────────────────────────────
    infoForm = { nombre: '', apellido_paterno: '', apellido_materno: '', telefono: '' };
    savingInfo = signal(false);
    infoSuccess = signal(false);
    infoError = signal('');

    // ── Email ─────────────────────────────────────────────────
    emailForm = { email: '', password: '' };
    savingEmail = signal(false);
    emailSuccess = signal(false);
    emailError = signal('');
    showEmailPass = signal(false);

    // ── Contraseña ────────────────────────────────────────────
    passForm = { old: '', new: '', confirm: '' };
    savingPass = signal(false);
    passSuccess = signal(false);
    passError = signal('');
    showOld = signal(false);
    showNew = signal(false);
    showConfirm = signal(false);

    // ── Colores y helpers ─────────────────────────────────────
    private roleColors: Record<string, string> = {
        alumno: '#10b981',
        docente: '#f59e0b',
        admin: '#ef4444',
        padre: '#8b5cf6',
        psicologa: '#0ea5e9',
    };

    roleColor = () => this.roleColors[this.user()?.rol ?? ''] ?? '#64748b';

    initials = () => {
        const u = this.user();
        if (!u) return 'U';
        return (
            (u.nombre?.charAt(0) ?? '') +
            (u.apellido_paterno?.charAt(0) ?? '')
        ).toUpperCase() || 'U';
    };

    // ── Lifecycle ─────────────────────────────────────────────
    ngOnInit() {
        const u = this.user();
        if (u) {
            this.infoForm.nombre = u.nombre ?? '';
            this.infoForm.apellido_paterno = u.apellido_paterno ?? '';
            this.infoForm.apellido_materno = u.apellido_materno ?? '';
            this.infoForm.telefono = u.telefono ?? '';
        }
    }

    // ── Helper de errores ─────────────────────────────────────
    private extractError(e: any): string {
        const body = e?.error;
        if (typeof body?.message === 'string') return body.message;
        if (Array.isArray(body?.message)) return body.message.join(', ');
        if (typeof body?.message === 'object') return body.message?.message ?? 'Error inesperado';
        if (typeof e?.message === 'string') return e.message;
        return 'Error al conectar con el servidor';
    }

    // ── Foto ──────────────────────────────────────────────────
    onFotoSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            this.fotoError.set('La imagen supera los 2MB.');
            return;
        }

        this.fotoFile.set(file);
        this.fotoError.set('');

        const reader = new FileReader();
        reader.onload = (e) => this.fotoPreview.set(e.target?.result as string);
        reader.readAsDataURL(file);
    }

    uploadFoto() {
        const file = this.fotoFile();
        if (!file) return;

        const form = new FormData();
        form.append('foto', file);

        this.uploadingFoto.set(true);
        this.fotoSuccess.set(false);
        this.fotoError.set('');

        this.api.post('users/foto', form).subscribe({
            next: (res: any) => {
                this.uploadingFoto.set(false);
                this.fotoSuccess.set(true);
                this.fotoFile.set(null);

                const fotoUrl = res?.data?.foto_url ?? res?.foto_url;
                if (fotoUrl) {
                    this.fotoPreview.set(fotoUrl);
                    // Actualiza el signal Y el localStorage de una sola vez
                    this.auth.updateCurrentUser({ foto_url: fotoUrl });
                }

                setTimeout(() => this.fotoSuccess.set(false), 4000);
            },
            error: (e) => {
                this.uploadingFoto.set(false);
                this.fotoError.set(this.extractError(e));
            },
        });
    }

    // ── Info personal ─────────────────────────────────────────
    saveInfo() {
        this.savingInfo.set(true);
        this.infoSuccess.set(false);
        this.infoError.set('');

        this.api.patch('users/profile', this.infoForm).subscribe({
            next: () => {
                this.savingInfo.set(false);
                this.infoSuccess.set(true);
                // ← Actualiza el signal en tiempo real
                this.auth.updateCurrentUser({
                    nombre: this.infoForm.nombre,
                    apellido_paterno: this.infoForm.apellido_paterno,
                    apellido_materno: this.infoForm.apellido_materno,
                    telefono: this.infoForm.telefono,
                });
                setTimeout(() => this.infoSuccess.set(false), 4000);
            },
            error: (e) => {
                this.savingInfo.set(false);
                this.infoError.set(this.extractError(e));
            },
        });
    }

    // ── Email ─────────────────────────────────────────────────
    saveEmail() {
        this.savingEmail.set(true);
        this.emailSuccess.set(false);
        this.emailError.set('');

        this.api.patch('users/email', this.emailForm).subscribe({
            next: () => {
                this.savingEmail.set(false);
                this.emailSuccess.set(true);
                // ← Actualiza el signal en tiempo real
                this.auth.updateCurrentUser({ email: this.emailForm.email });
                this.emailForm = { email: '', password: '' };
                setTimeout(() => this.emailSuccess.set(false), 4000);
            },
            error: (e) => {
                this.savingEmail.set(false);
                this.emailError.set(this.extractError(e));
            },
        });
    }

    // ── Contraseña ────────────────────────────────────────────
    savePassword() {
        if (this.passForm.new !== this.passForm.confirm) return;
        this.savingPass.set(true);
        this.passSuccess.set(false);
        this.passError.set('');

        this.api.patch('users/password', {
            current_password: this.passForm.old,
            new_password: this.passForm.new,
        }).subscribe({
            next: () => {
                this.savingPass.set(false);
                this.passSuccess.set(true);
                this.passForm = { old: '', new: '', confirm: '' };
                setTimeout(() => this.passSuccess.set(false), 4000);
            },
            error: (e) => {
                this.savingPass.set(false);
                this.passError.set(this.extractError(e));
            },
        });
    }
}