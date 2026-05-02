import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

interface PsyTab {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-psychology-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    MatIconModule, PageHeader,
  ],
  templateUrl: './psychology-dashboard.html',
  styleUrl: './psychology-dashboard.scss',
})
export class PsychologyDashboard {
  readonly tabs: PsyTab[] = [
    { label: 'Mis alumnos',     icon: 'groups',       route: 'alumnos' },
    { label: 'Fichas',          icon: 'folder_open',  route: 'fichas' },
    { label: 'Citas',           icon: 'event',        route: 'citas' },
    { label: 'Disponibilidad',  icon: 'schedule',     route: 'disponibilidad' },
  ];
}
