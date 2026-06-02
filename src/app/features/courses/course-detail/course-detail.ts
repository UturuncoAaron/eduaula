import {
  ChangeDetectionStrategy, Component,
  computed, effect, inject, DestroyRef, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth';
import { LazyCourseStore } from '../data-access/lazy-course.store';
import { Course, SemanaResumen } from '../../../core/models/course';
import { PeriodoService } from '../../../core/services/periodo';
import { BimestreFilterService } from '@core/models/bimestre-filter';

interface CourseTab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    MatIconModule, MatButtonModule, MatTabsModule, MatTooltipModule,
  ],
  providers: [BimestreFilterService],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetail implements OnInit {
  readonly auth = inject(AuthService);
  readonly bimFiltro = inject(BimestreFilterService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(LazyCourseStore);
  private readonly periodoSvc = inject(PeriodoService);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  readonly course = signal<Course | null>(null);
  readonly courseId = signal('');
  readonly semanasCount = signal(0);
  readonly bimestresCount = signal(0);
  readonly bimReady = signal(false);

  private readonly semanasAll = signal<SemanaResumen[]>([]);

  readonly bimestresDisponibles = computed<number[]>(() =>
    [...new Set(this.semanasAll().map(s => s.bimestre))].sort((a, b) => a - b),
  );

  readonly periodoLabel = computed<string | null>(() => {
    const c = this.course();
    if (!c) return null;
    const p = this.periodoSvc.all().find(x => x.anio === c.anio && x.activo);
    if (p) return p.nombre?.trim() || `Bim ${p.bimestre} · ${p.anio}`;
    return `Año ${c.anio}`;
  });

  readonly tabs = computed<CourseTab[]>(() => {
    const base: CourseTab[] = [
      { path: 'contenido', label: 'Contenido', icon: 'school' },
      { path: 'actividades', label: 'Actividades', icon: 'task_alt' },
      { path: 'foro', label: 'Foro', icon: 'forum' },
      { path: 'materiales', label: 'Materiales', icon: 'folder' },
    ];
    if (this.auth.isDocente() || this.auth.isAdmin()) {
      base.push({ path: 'asistencia', label: 'Asistencia', icon: 'fact_check' });
    }
    return base;
  });

  readonly calificacionesQueryParams = computed(() => {
    const c = this.course();
    if (!c) return null;
    const p = this.periodoSvc.all().find(x => x.anio === c.anio && x.activo);
    return {
      cursoId: c.id,
      cursoNombre: c.nombre,
      bimestre: p?.bimestre ?? 1,
      periodoId: p?.id ?? null,
    };
  });

  readonly misNotasQueryParams = computed(() => {
    const c = this.course();
    if (!c) return null;
    return { cursoId: c.id };
  });

  constructor() {
    effect(() => {
      const c = this.course();
      const periodos = this.periodoSvc.all();
      if (!c || !periodos.length) return;
      if (this.bimReady()) return;

      const activo = periodos.find(x => x.anio === c.anio && x.activo);
      if (activo) this.bimFiltro.set(activo.bimestre);
      this.bimReady.set(true);
    });
  }

  ngOnInit(): void {
    this.courseId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.loadCourse();
    this.periodoSvc.loadAll();
  }

  private loadCourse(): void {
    const id = this.courseId();
    if (!id) return;

    this.store.course$(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => {
        if (c) {
          this.course.set(c);
        }
      });

    this.store.semanas$(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.semanasAll.set(list);
        this.semanasCount.set(list.length);
        this.bimestresCount.set(new Set(list.map(s => s.bimestre)).size);
      });
  }

  setBimestre(bimestre: number | null): void {
    this.bimFiltro.set(bimestre);
  }

  goBack(): void { this.location.back(); }
}