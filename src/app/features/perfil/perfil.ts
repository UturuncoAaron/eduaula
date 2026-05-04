import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/auth/auth';
import { ApiService } from '../../core/services/api';
import { UserRole } from '../../shared/components/sidebar/navigation.config';
import { UserDialog } from '../../shared/components/user-dialog/user-dialog';

@Component({
    selector: 'app-perfil',
    standalone: true,
    imports: [MatIconModule, MatButtonModule, DatePipe],
    templateUrl: './perfil.html',
    styleUrl: './perfil.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil {
    private auth = inject(AuthService);
    private api = inject(ApiService);
    private dialog = inject(MatDialog);
    private cdr = inject(ChangeDetectorRef);

    user = this.auth.currentUser;

    private roleLabels: Record<UserRole, string> = {
        alumno: 'Estudiante',
        docente: 'Docente',
        admin: 'Administrador',
        padre: 'Padre / Tutor',
        psicologa: 'Psicóloga',
    };

    private roleColors: Record<UserRole, string> = {
        alumno: '#10b981',
        docente: '#f59e0b',
        admin: '#ef4444',
        padre: '#8b5cf6',
        psicologa: '#0ea5e9',
    };

    initials = () => {
        const u = this.user();
        if (!u) return 'U';
        return ((u.nombre?.charAt(0) ?? '') + (u.apellido_paterno?.charAt(0) ?? '')).toUpperCase() || 'U';
    };
    roleLabel = () => this.roleLabels[this.user()?.rol as UserRole] ?? 'Usuario';
    roleColor = () => this.roleColors[this.user()?.rol as UserRole] ?? '#64748b';

    openEditProfileDialog() {
        const user = this.user();
        if (!user) return;

        const ref = this.dialog.open(UserDialog, {
            width: '700px',
            maxWidth: '95vw',
            disableClose: true,
            data: {
                mode: 'edit',
                rol: user.rol,
                isSelf: true,
                user,
            },
        });

        ref.afterClosed().subscribe((result) => {
            if (!result?.updated) return;
            this.api.get<any>('users/me').subscribe({
                next: (res) => {
                    const fresh = res?.data ?? res;
                    this.auth.updateCurrentUser(fresh);
                    this.cdr.markForCheck();
                },
            });
        });
    }
}