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
  private csSvc = inject(CourseService);

  courses = this.csSvc.courses;
  loading = this.csSvc.loading;

  readonly iconMap: Record<string, string> = {
    matemáticas: 'auto_graph',
    comunicación: 'import_contacts',
    historia: 'account_balance',
    inglés: 'language',
    ciencia: 'biotech',
    arte: 'architecture',
    educación: 'fitness_center',
    computación: 'terminal',
    religión: 'gavel',
    tutoría: 'psychology',
    música: 'music_note',
  };

  // Retorna el icono basado en coincidencias del nombre
  getIcon(nombre: string): string {
    const lower = nombre.toLowerCase();
    for (const [key, icon] of Object.entries(this.iconMap)) {
      if (lower.includes(key)) return icon;
    }
    return 'layers';
  }

  // Carga inicial de asignaturas desde el store
  ngOnInit() {
    this.csSvc.loadMyCourses().subscribe({ error: () => { } });
  }
}