import {
  ChangeDetectionStrategy, Component,
  computed, inject, DestroyRef, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../core/auth/auth';
import { LazyCourseStore } from '../data-access/lazy-course.store';
import { Course } from '../../../core/models/course';
import { CourseHeaderSkeleton } from '../../../shared/components/skeletons/skeletons';

interface CourseTab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-course-detail',
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    MatIconModule, MatButtonModule, MatTabsModule,
    CourseHeaderSkeleton,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetail implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private store = inject(LazyCourseStore);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);

  course = signal<Course | null>(null);
  courseId = signal('');

  readonly tabs: CourseTab[] = [
    { path: 'contenido',   label: 'Contenido',     icon: 'menu_book' },
    { path: 'actividades', label: 'Actividades',   icon: 'assignment' },
    { path: 'foro',        label: 'Mensajes / Foro', icon: 'forum' },
    { path: 'materiales',  label: 'Materiales',    icon: 'folder' },
  ];

  readonly calificacionesQueryParams = computed(() => {
    const c = this.course();
    if (!c) return null;
    return {
      cursoId: c.id,
      cursoNombre: c.nombre,
      bimestre: 1,
      periodoId: c.periodo_id,
    };
  });

  ngOnInit() {
    this.courseId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.loadCourse();
  }

  private loadCourse() {
    const id = this.courseId();
    if (!id) return;
    // Primer fetch crítico (above-the-fold). El cache compartido con
    // LazyCourseStore evita que tab-contenido refetchee.
    this.store.course$(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => this.course.set(c));
  }

  goBack() { this.location.back(); }
}
