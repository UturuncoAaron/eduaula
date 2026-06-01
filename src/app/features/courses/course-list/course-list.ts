import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { CourseService } from '../data-access/course.store';

@Component({
  selector: 'app-course-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, RouterLink,
  ],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss'
})
export class CourseList implements OnInit {
  readonly auth = inject(AuthService);
  private readonly csSvc = inject(CourseService);

  // Signals reactivos mapeados del Store
  readonly courses = this.csSvc.courses;
  readonly loading = this.csSvc.loading;

  // Mapa de íconos según áreas y nombres maestros
  readonly iconMap: Record<string, string> = {
    matemát: 'auto_graph',
    comunicac: 'import_contacts',
    historia: 'account_balance',
    inglés: 'language',
    ciencia: 'biotech',
    arte: 'architecture',
    física: 'fitness_center',
    computac: 'terminal',
    religión: 'gavel',
    tutoría: 'psychology',
    música: 'music_note',
  };

  getIcon(nombre: string): string {
    const lower = nombre.toLowerCase();
    for (const [key, icon] of Object.entries(this.iconMap)) {
      if (lower.includes(key)) return icon;
    }
    return 'layers';
  }

  ngOnInit(): void {
    this.csSvc.loadMyCourses().subscribe({ error: () => { } });
  }
}