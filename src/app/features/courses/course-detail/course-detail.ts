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
import { PeriodoService } from '../../../core/services/periodo';
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
  private periodoSvc = inject(PeriodoService);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);

  course = signal<Course | null>(null);
  courseId = signal('');
  semanasCount = signal(0);
  bimestresCount = signal(0);

  // Etiqueta legible del período del curso (ej. "Bim 1 · 2025"). Se resuelve
  // contra PeriodoService.all() — si la lista no está cargada todavía, devuelve
  // null y el chip simplemente no se muestra hasta que llegue la data.
  readonly periodoLabel = computed<string | null>(() => {
    const c = this.course();
    if (!c) return null;
    const id = String(c.periodo_id);
    const p = this.periodoSvc.all().find(x => String(x.id) === id);
    if (!p) return null;
    return p.nombre?.trim() || `Bim ${p.bimestre} · ${p.anio}`;
  });

  readonly tabs: CourseTab[] = [
    { path: 'contenido',   label: 'Contenido',    icon: 'school' },
    { path: 'actividades', label: 'Actividades',  icon: 'task_alt' },
    { path: 'foro',        label: 'Foro',         icon: 'forum' },
    { path: 'materiales',  label: 'Materiales',   icon: 'folder' },
    { path: 'asistencia',  label: 'Asistencia',   icon: 'fact_check' },
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
    // Carga la lista de períodos (idempotente, cacheada) para resolver el
    // nombre del período del curso en el header.
    this.periodoSvc.loadAll();
  }

  private loadCourse() {
    const id = this.courseId();
    if (!id) return;
    // Primer fetch crítico (above-the-fold). El cache compartido con
    // LazyCourseStore evita que tab-contenido refetchee.
    this.store.course$(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => this.course.set(c));
    // Semanas también above-the-fold para mostrar el conteo en el header.
    // Comparten cache con tab-contenido vía shareReplay.
    this.store.semanas$(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.semanasCount.set(list.length);
        this.bimestresCount.set(new Set(list.map(s => s.bimestre)).size);
      });
  }

  goBack() { this.location.back(); }
}
