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

// ────────────────────────────────────────────────────────────────────────
// Mapeo estado FRONTEND <-> BACKEND.
//
// El backend (BD + entity) almacena 4 estados: `asistio`, `falta`,
// `tardanza`, `justificado`. La UI maneja 5: `presente`, `ausente`,
// `tardanza`, `permiso`, `licencia`. Como el backend no diferencia entre
// `permiso` y `licencia`, los colapsamos a `justificado` y persistimos la
// distinción original en `observacion` con el prefijo `[permiso]` o
// `[licencia]`. Al leer, recuperamos la marca para restaurar el estado UI.
// ────────────────────────────────────────────────────────────────────────

export type EstadoAsistenciaBackend =
  | 'asistio'
  | 'falta'
  | 'tardanza'
  | 'justificado';

export interface BackendAsistenciaPayload {
  estado: EstadoAsistenciaBackend;
  observacion?: string;
}

export function toBackendEstado(
  estado: EstadoAsistencia,
  observacion?: string | null,
): BackendAsistenciaPayload {
  const obs = (observacion ?? '').trim();
  switch (estado) {
    case 'presente':
      return obs ? { estado: 'asistio', observacion: obs } : { estado: 'asistio' };
    case 'tardanza':
      return obs ? { estado: 'tardanza', observacion: obs } : { estado: 'tardanza' };
    case 'ausente':
      return obs ? { estado: 'falta', observacion: obs } : { estado: 'falta' };
    case 'permiso':
      return { estado: 'justificado', observacion: obs ? `[permiso] ${obs}` : '[permiso]' };
    case 'licencia':
      return { estado: 'justificado', observacion: obs ? `[licencia] ${obs}` : '[licencia]' };
  }
}

export function fromBackendEstado(
  estado: EstadoAsistenciaBackend | string,
  observacion?: string | null,
): { estado: EstadoAsistencia; observacion: string } {
  const obs = observacion ?? '';
  switch (estado) {
    case 'asistio':
      return { estado: 'presente', observacion: obs };
    case 'tardanza':
      return { estado: 'tardanza', observacion: obs };
    case 'falta':
      return { estado: 'ausente', observacion: obs };
    case 'justificado': {
      if (obs.startsWith('[licencia]')) {
        return { estado: 'licencia', observacion: obs.replace(/^\[licencia\]\s*/, '') };
      }
      // default: permiso (cubre tanto '[permiso]' como observaciones sin marca)
      return { estado: 'permiso', observacion: obs.replace(/^\[permiso\]\s*/, '') };
    }
    default:
      // Estado desconocido: fallback razonable.
      return { estado: 'presente', observacion: obs };
  }
}
