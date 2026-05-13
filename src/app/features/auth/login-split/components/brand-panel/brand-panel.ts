import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Panel de branding del login (lado izquierdo del split). Pintaba metadata
 * dinámica del colegio (`/configuracion`) y conteos (`/admin/users/stats`),
 * pero esos endpoints fueron retirados del backend. Hoy el panel es estático
 * para evitar 404 ruidosos en la pantalla de login.
 *
 * Si vuelven a existir endpoints públicos de branding, se pueden re-inyectar
 * acá vía `HttpClient` sin romper la API del componente.
 */
@Component({
    selector: 'app-brand-panel',
    imports: [MatIconModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './brand-panel.html',
    styleUrl: './brand-panel.scss',
})
export class BrandPanel {
    readonly nombreColegio = signal('IE Juan Pablo Vizcardo y Guzmán');
    readonly ugel = signal('UGEL 04 · Comas, Lima · Perú');
    readonly anioEscolar = signal('2026');
    readonly director = signal('');

    readonly stats = signal([
        { label: 'Alumnos', value: '—', icon: 'school' },
        { label: 'Docentes', value: '—', icon: 'person' },
        { label: 'Cursos', value: '—', icon: 'menu_book' },
    ]);
}
