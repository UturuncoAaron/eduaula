import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api';
import { TaskService } from '../../tasks/data-access/task.store';
import {
  Course, LiveClass, Material, SemanaResumen,
} from '../../../core/models/course';
import { Task } from '../../../core/models/task';
import { Forum } from '../../../core/models/forum';

/**
 * Bundle de items agrupados por semana.
 * Se construye una sola vez por cursoId y se reusa entre tabs/expansiones.
 */
export interface ItemsByWeek {
  materials: Map<number, Material[]>;
  tasks:     Map<number, Task[]>;
  forums:    Map<number, Forum[]>;
}

/**
 * Store con caché global por cursoId basado en `shareReplay`.
 *
 * - Lecturas idempotentes: subscribirse N veces dispara el fetch UNA sola vez.
 * - El cache vive mientras el servicio (singleton root) — sobrevive a la
 *   navegación entre tabs hijos del curso.
 * - Cancelación: los componentes que consumen estos observables deben usar
 *   `takeUntilDestroyed(destroyRef)` o `toSignal({ injector })` para que la
 *   suscripción se cierre al desmontar — el observable cacheado sigue vivo.
 *
 * Para invalidar (post-create / post-delete) usar `invalidate*(courseId)`.
 */
@Injectable({ providedIn: 'root' })
export class LazyCourseStore {
  private api = inject(ApiService);
  private taskSvc = inject(TaskService);

  private courseStreams   = new Map<string, Observable<Course | null>>();
  private semanasStreams  = new Map<string, Observable<SemanaResumen[]>>();
  private itemsStreams    = new Map<string, Observable<ItemsByWeek>>();
  private liveStreams     = new Map<string, Observable<LiveClass[]>>();

  /** Curso meta. Usar con `toSignal()` o `takeUntilDestroyed()`. */
  course$(courseId: string): Observable<Course | null> {
    let s = this.courseStreams.get(courseId);
    if (!s) {
      s = this.api.get<Course>(`courses/${courseId}`).pipe(
        map(r => r.data ?? null),
        catchError(() => of(null as Course | null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.courseStreams.set(courseId, s);
    }
    return s;
  }

  /** Lista de semanas del curso. */
  semanas$(courseId: string): Observable<SemanaResumen[]> {
    let s = this.semanasStreams.get(courseId);
    if (!s) {
      s = this.api.get<SemanaResumen[]>(`courses/${courseId}/semanas`).pipe(
        map(r => r.data ?? []),
        catchError(() => of<SemanaResumen[]>([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.semanasStreams.set(courseId, s);
    }
    return s;
  }

  /**
   * Bundle de items (materials + tasks + forums) agrupados por semana.
   * Se carga una sola vez por curso. Los componentes lo invocan **solo**
   * cuando el usuario expande la primera semana (lazy on first interaction).
   */
  items$(courseId: string): Observable<ItemsByWeek> {
    let s = this.itemsStreams.get(courseId);
    if (!s) {
      s = forkJoin({
        materials: this.api.get<Material[]>(`courses/${courseId}/materials`)
          .pipe(map(r => r.data ?? []), catchError(() => of<Material[]>([]))),
        tasks: this.taskSvc.getTasks(courseId)
          .pipe(map(r => r.data ?? []), catchError(() => of<Task[]>([]))),
        forums: this.api.get<Forum[]>(`courses/${courseId}/forums`)
          .pipe(map(r => r.data ?? []), catchError(() => of<Forum[]>([]))),
      }).pipe(
        map(({ materials, tasks, forums }) => groupByWeek(materials, tasks, forums)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.itemsStreams.set(courseId, s);
    }
    return s;
  }

  /** Videoconferencias del curso. Lazy: solo al expandir el panel. */
  liveClasses$(courseId: string): Observable<LiveClass[]> {
    let s = this.liveStreams.get(courseId);
    if (!s) {
      s = this.api.get<LiveClass[]>(`courses/${courseId}/live-classes`).pipe(
        map(r => [...(r.data ?? [])].sort(
          (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
        )),
        catchError(() => of<LiveClass[]>([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.liveStreams.set(courseId, s);
    }
    return s;
  }

  /**
   * Prefetch en idle. Llamar después de que el usuario expande una semana
   * para warmear el cache (no bloquea el hilo principal).
   */
  prefetchItems(courseId: string): void {
    if (this.itemsStreams.has(courseId)) return;
    const run = () => this.items$(courseId).subscribe();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 2000);
    }
  }

  // ── Invalidación (llamar tras crear/editar/eliminar) ──────────
  invalidateItems(courseId: string): void {
    this.itemsStreams.delete(courseId);
  }
  invalidateLiveClasses(courseId: string): void {
    this.liveStreams.delete(courseId);
  }
  invalidateSemanas(courseId: string): void {
    this.semanasStreams.delete(courseId);
  }
  invalidateAll(courseId: string): void {
    this.invalidateItems(courseId);
    this.invalidateLiveClasses(courseId);
    this.invalidateSemanas(courseId);
    this.courseStreams.delete(courseId);
  }
}

/** Agrupa items por número de semana (descarta los que no tienen `semana`). */
function groupByWeek(
  materials: Material[], tasks: Task[], forums: Forum[],
): ItemsByWeek {
  const m = new Map<number, Material[]>();
  const t = new Map<number, Task[]>();
  const f = new Map<number, Forum[]>();
  for (const x of materials) {
    if (!x.semana) continue;
    (m.get(x.semana) ?? m.set(x.semana, []).get(x.semana)!).push(x);
  }
  for (const x of tasks) {
    if (!x.semana) continue;
    (t.get(x.semana) ?? t.set(x.semana, []).get(x.semana)!).push(x);
  }
  for (const x of forums) {
    if (!x.semana) continue;
    (f.get(x.semana) ?? f.set(x.semana, []).get(x.semana)!).push(x);
  }
  return { materials: m, tasks: t, forums: f };
}
