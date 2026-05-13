export type EstadoAsistencia =
  | 'presente'
  | 'ausente'
  | 'tardanza'
  | 'permiso'
  | 'licencia';

export interface AsistenciaCurso {
  id: string;
  alumno_id: string;
  curso_id: string;
  fecha: string;
  estado: EstadoAsistencia;
  observacion?: string | null;
  created_at: string;
  alumno?: {
    id?: string;
    nombre?: string | null;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
  } | null;
}

export interface EnrollmentRow {
  alumno_id?: string;
  alumno?: {
    id: string;
    nombre?: string | null;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
  } | null;
}

export interface RosterRow {
  alumnoId: string;
  nombre: string;
  estado: EstadoAsistencia | null;
  observacion: string;
  /** id del registro existente en backend, si hay. */
  asistenciaId?: string;
  dirty: boolean;
}

export interface EstadoMeta {
  value: EstadoAsistencia;
  label: string;
  icon: string;
  class: string;
}

export const ESTADOS: EstadoMeta[] = [
  { value: 'presente', label: 'Presente', icon: 'check_circle',     class: 'estado-presente' },
  { value: 'tardanza', label: 'Tardanza', icon: 'schedule',         class: 'estado-tardanza' },
  { value: 'ausente',  label: 'Ausente',  icon: 'cancel',           class: 'estado-ausente'  },
  { value: 'permiso',  label: 'Permiso',  icon: 'event_busy',       class: 'estado-permiso'  },
  { value: 'licencia', label: 'Licencia', icon: 'medical_services', class: 'estado-licencia' },
];

export function estadoBadgeClass(estado: EstadoAsistencia | null): string {
  return ESTADOS.find(e => e.value === estado)?.class ?? '';
}

export function estadoLabel(estado: EstadoAsistencia | null): string {
  return ESTADOS.find(e => e.value === estado)?.label ?? '—';
}

export function fullName(a: { nombre?: string | null; apellido_paterno?: string | null; apellido_materno?: string | null } | null | undefined): string {
  if (!a) return '(sin nombre)';
  const parts = [a.nombre, a.apellido_paterno, a.apellido_materno].filter(Boolean);
  return parts.length ? parts.join(' ') : '(sin nombre)';
}
