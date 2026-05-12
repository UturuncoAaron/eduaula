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

  readonly gradients = [
    'linear-gradient(135deg, #1e3a8a, #3b82f6)',
    'linear-gradient(135deg, #065f46, #34d399)',
    'linear-gradient(135deg, #581c87, #a855f7)',
    'linear-gradient(135deg, #9a3412, #fb923c)',
    'linear-gradient(135deg, #155e75, #22d3ee)',
    'linear-gradient(135deg, #881337, #f43f5e)',
    'linear-gradient(135deg, #3730a3, #818cf8)',
    'linear-gradient(135deg, #854d0e, #facc15)',
  ];

  readonly iconMap: Record<string, string> = {
    matemáticas: 'calculate', comunicación: 'menu_book',
    historia: 'public', inglés: 'translate',
    ciencia: 'science', arte: 'palette',
    educación: 'sports_soccer', computación: 'computer',
    religión: 'church', tutoría: 'groups',
    música: 'music_note',
  };

  getIcon(nombre: string): string {
    const lower = nombre.toLowerCase();
    for (const [key, icon] of Object.entries(this.iconMap)) {
      if (lower.includes(key)) return icon;
    }
    return 'school';
  }

  getInitials(nombre: string): string {
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  ngOnInit() {
    this.csSvc.loadMyCourses().subscribe({ error: () => {} });
  }
}