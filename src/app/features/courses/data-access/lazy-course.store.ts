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

export interface ItemsByWeek {
  materials: Map<number, Material[]>;
  tasks: Map<number, Task[]>;
  forums: Map<number, Forum[]>;
}

export interface RosterStudent {
  id: string;
  enrollment_id: string;
  codigo_estudiante: string | null;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  email?: string | null;
  foto_storage_key?: string | null;
  inclusivo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LazyCourseStore {
  private api = inject(ApiService);
  private taskSvc = inject(TaskService);

  private courseStreams = new Map<string, Observable<Course | null>>();
  private semanasStreams = new Map<string, Observable<SemanaResumen[]>>();
  private itemsStreams = new Map<string, Observable<ItemsByWeek>>();
  private liveStreams = new Map<string, Observable<LiveClass[]>>();
  private rosterStreams = new Map<string, Observable<RosterStudent[]>>();
  private rosterRawStreams = new Map<string, Observable<unknown[]>>();

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

  roster$(seccionId: string): Observable<RosterStudent[]> {
    let s = this.rosterStreams.get(seccionId);
    if (!s) {
      s = this.rosterRaw$(seccionId).pipe(
        map(rows => rows.map(normalizeRosterStudent)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.rosterStreams.set(seccionId, s);
    }
    return s;
  }

  rosterRaw$<T = unknown>(seccionId: string): Observable<T[]> {
    let s = this.rosterRawStreams.get(seccionId);
    if (!s) {
      s = this.api.get<unknown[]>(`courses/seccion/${seccionId}/students`).pipe(
        map(r => r.data ?? []),
        catchError(() => of<unknown[]>([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.rosterRawStreams.set(seccionId, s);
    }
    return s as Observable<T[]>;
  }

  invalidateRoster(seccionId: string): void {
    this.rosterStreams.delete(seccionId);
    this.rosterRawStreams.delete(seccionId);
  }

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

  prefetchItems(courseId: string): void {
    if (this.itemsStreams.has(courseId)) return;
    const run = () => this.items$(courseId).subscribe();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 2000);
    }
  }

  invalidateItems(courseId: string): void { this.itemsStreams.delete(courseId); }
  invalidateLiveClasses(courseId: string): void { this.liveStreams.delete(courseId); }
  invalidateSemanas(courseId: string): void { this.semanasStreams.delete(courseId); }
  invalidateAll(courseId: string): void {
    this.invalidateItems(courseId);
    this.invalidateLiveClasses(courseId);
    this.invalidateSemanas(courseId);
    this.courseStreams.delete(courseId);
  }
}

function normalizeRosterStudent(raw: any): RosterStudent {
  const a = raw?.alumno ?? raw ?? {};
  return {
    id: String(a.id ?? raw?.alumno_id ?? ''),
    enrollment_id: String(raw?.id ?? a.enrollment_id ?? ''),
    codigo_estudiante: a.codigo_estudiante ?? raw?.codigo_estudiante ?? null,
    nombre: a.nombre ?? raw?.nombre ?? '',
    apellido_paterno: a.apellido_paterno ?? raw?.apellido_paterno ?? '',
    apellido_materno: a.apellido_materno ?? raw?.apellido_materno ?? null,
    email: a.email ?? raw?.email ?? null,
    foto_storage_key: a.foto_storage_key ?? raw?.foto_storage_key ?? null,
    inclusivo: Boolean(a.inclusivo ?? raw?.inclusivo),
  };
}

function groupByWeek(materials: Material[], tasks: Task[], forums: Forum[]): ItemsByWeek {
  const m = new Map<number, Material[]>();
  const t = new Map<number, Task[]>();
  const f = new Map<number, Forum[]>();
  for (const x of materials) { if (x.semana) (m.get(x.semana) ?? m.set(x.semana, []).get(x.semana)!).push(x); }
  for (const x of tasks) { if (x.semana) (t.get(x.semana) ?? t.set(x.semana, []).get(x.semana)!).push(x); }
  for (const x of forums) { if (x.semana) (f.get(x.semana) ?? f.set(x.semana, []).get(x.semana)!).push(x); }
  return { materials: m, tasks: t, forums: f };
}

export type EstadoAsistencia = 'presente' | 'ausente' | 'tardanza';

export interface RosterRow {
  alumnoId: string;
  nombre: string;
  estado: EstadoAsistencia | null;
  observacion: string;
  asistenciaId?: string;
  dirty: boolean;
}

export function toBackendEstado(estado: EstadoAsistencia, obs?: string): { estado: string, observacion?: string } {
  const o = obs?.trim() ?? '';
  const map: Record<EstadoAsistencia, string> = {
    presente: 'asistio',
    ausente: 'falta',
    tardanza: 'tardanza'
  };
  return { estado: map[estado], observacion: o || undefined };
}

export function fromBackendEstado(estado: string, obs?: string | null): { estado: EstadoAsistencia, observacion: string } {
  const o = obs ?? '';
  switch (estado) {
    case 'asistio': return { estado: 'presente', observacion: o };
    case 'tardanza': return { estado: 'tardanza', observacion: o };
    case 'falta': return { estado: 'ausente', observacion: o };
    default: return { estado: 'presente', observacion: o };
  }
}