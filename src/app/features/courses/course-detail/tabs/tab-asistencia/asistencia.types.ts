export type EstadoAsistencia = 'presente' | 'tardanza' | 'falto' | 'justificado';

export interface RosterRow {
  alumnoId: string;
  nombre: string;
  estado: EstadoAsistencia | null;
  observacion: string;
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
  { value: 'presente', label: 'Presente', icon: 'check_circle', class: 'estado-presente' },
  { value: 'tardanza', label: 'Tardanza', icon: 'schedule', class: 'estado-tardanza' },
  { value: 'falto', label: 'Faltó', icon: 'cancel', class: 'estado-ausente' },
  { value: 'justificado', label: 'Justificado', icon: 'verified_user', class: 'estado-permiso' },
];

export type EstadoAsistenciaBackend = 'asistio' | 'falta' | 'tardanza' | 'justificado';

export function toBackendEstado(estado: EstadoAsistencia, obs?: string | null): { estado: EstadoAsistenciaBackend, observacion?: string } {
  const o = (obs ?? '').trim();
  const map: Record<EstadoAsistencia, EstadoAsistenciaBackend> = {
    presente: 'asistio',
    tardanza: 'tardanza',
    falto: 'falta',
    justificado: 'justificado'
  };
  return { estado: map[estado], observacion: o || undefined };
}

export function fromBackendEstado(estado: string, obs?: string | null): { estado: EstadoAsistencia, observacion: string } {
  const o = obs ?? '';
  switch (estado) {
    case 'asistio': return { estado: 'presente', observacion: o };
    case 'tardanza': return { estado: 'tardanza', observacion: o };
    case 'falta': return { estado: 'falto', observacion: o }; 
    case 'justificado': return { estado: 'justificado', observacion: o };
    default: return { estado: 'presente', observacion: o };
  }
}
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

export interface AsistenciaCurso {
  id: string;
  alumno_id: string;
  curso_id: string;
  fecha: string;
  estado: string; // O EstadoAsistenciaBackend
  observacion?: string | null;
  created_at: string;
  alumno?: {
    id?: string;
    nombre?: string | null;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
  } | null;
}