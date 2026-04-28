import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { Course } from '../../../../core/models/course';

// Tab components — lazy loaded via defer in template
import { TabContenido } from '../tabs/tab-contenido/tab-contenido';
import { TabMateriales} from '../tabs/tab-materiales/tab-materiales';
import { TabTareas} from '../tabs/tab-tareas/tab-tareas';
import { TabExamenes } from '../tabs/tab-examenes/tab-examenes';
import { TabForo } from '../tabs/tab-foro/tab-foro';

@Component({
  selector: 'app-course-detail',
  imports: [
    MatIconModule, MatButtonModule, MatTabsModule,
    TabContenido, TabMateriales,
    TabTareas, TabExamenes, TabForo,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private csSvc = inject(CourseService);
  private location = inject(Location);

  course = signal<Course | null>(null);
  courseId = '';

  /** Tracks which tabs have been activated at least once (for lazy loading) */
  tabLoaded = signal<Record<number, boolean>>({ 0: true });

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    this.loadCourse();
  }

  loadCourse() {
    this.csSvc.getCourse(this.courseId).subscribe({
      next: res => this.course.set(res.data),
      error: () => { },
    });
  }

  onTabChange(index: number) {
    this.tabLoaded.update(loaded => ({ ...loaded, [index]: true }));
  }

  iniciales(d?: { nombre?: string; apellido_paterno?: string } | null): string {
    if (!d) return 'D';
    return ((d.nombre?.[0] ?? '') + (d.apellido_paterno?.[0] ?? '')).toUpperCase() || 'D';
  }

  goBack() { this.location.back(); }
}