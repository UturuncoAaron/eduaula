// Tipos compartidos del editor de horario de sección.

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

export const DIAS: { key: DiaSemana; label: string; short: string }[] = [
  { key: 'lunes',     label: 'Lunes',     short: 'Lun' },
  { key: 'martes',    label: 'Martes',    short: 'Mar' },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié' },
  { key: 'jueves',    label: 'Jueves',    short: 'Jue' },
  { key: 'viernes',   label: 'Viernes',   short: 'Vie' },
];

/** Slot servido por backend (hora HH:mm). */
export interface ServerSlot {
  /** Backend lo devuelve como entero o uuid según versión — sólo lo usamos como id local. */
  id: number | string;
  dia_semana: DiaSemana;
  hora_inicio: string; // HH:mm
  hora_fin: string;    // HH:mm
  aula: string | null;
}

export interface CourseSchedule {
  curso_id: string;
  curso_nombre: string;
  color: string;
  slots: ServerSlot[];
}

/** Slot "en edición" (sin id real, marcado como pendiente de guardar). */
export interface EditableSlot extends ServerSlot {
  curso_id: string;
  curso_nombre: string;
  color: string;
  /** True si el usuario lo creó/editó en esta sesión y aún no se guardó. */
  pending: boolean;
}

// Genera "07:00" → "17:00" en pasos de 30 min.
export function buildHourTicks(
  startHour = 7,
  endHour = 17,
  stepMinutes = 30,
): string[] {
  const out: string[] = [];
  for (let m = startHour * 60; m <= endHour * 60; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return out;
}

/** Convierte HH:mm → minutos absolutos en el día. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Inversa de toMinutes: minutos del día → "HH:mm". */
export function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Snap a un múltiplo del step (default 30) hacia abajo. */
export function snapDown(totalMin: number, step = 30): number {
  return Math.floor(totalMin / step) * step;
}

// ── Parámetros del render visual ─────────────────────────────────────
// Cada minuto = N píxeles. Con 1.6 px/min, una franja de 30 min mide 48px
// (suficiente para que el texto del curso quepa en una sola línea pequeña).
export const PX_PER_MIN = 1.6;
export const TICK_STEP_MIN = 30;
export const DAY_START_MIN = 7 * 60;  // 07:00
export const DAY_END_MIN = 17 * 60 + 30; // 17:30 (último tick inclusive)
