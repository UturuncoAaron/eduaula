import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth/auth';
import { UserRole } from '../../shared/components/sidebar/navigation.config';

@Component({
    selector: 'app-perfil',
    standalone: true,
    imports: [MatIconModule, MatButtonModule, RouterLink, DatePipe],
    templateUrl: './perfil.html',
    styleUrl: './perfil.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilComponent {
    private auth = inject(AuthService);
    user = this.auth.currentUser;

    private roleLabels: Record<UserRole, string> = {
        alumno: 'Estudiante', docente: 'Docente',
        admin: 'Administrador', padre: 'Padre / Tutor', psicologa: 'Psicóloga',
    };
    private roleColors: Record<UserRole, string> = {
        alumno: '#10b981', docente: '#f59e0b',
        admin: '#ef4444', padre: '#8b5cf6', psicologa: '#0ea5e9',
    };

    initials = () => {
        const u = this.user();
        if (!u) return 'U';
        return ((u.nombre?.charAt(0) ?? '') + (u.apellido_paterno?.charAt(0) ?? '')).toUpperCase() || 'U';
    };
    roleLabel = () => this.roleLabels[this.user()?.rol as UserRole] ?? 'Usuario';
    roleColor = () => this.roleColors[this.user()?.rol as UserRole] ?? '#64748b';
}