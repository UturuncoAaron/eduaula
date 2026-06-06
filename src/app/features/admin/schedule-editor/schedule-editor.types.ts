export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

export const DIAS: { key: DiaSemana; label: string; short: string }[] = [
  { key: 'lunes', label: 'Lunes', short: 'Lun' },
  { key: 'martes', label: 'Martes', short: 'Mar' },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié' },
  { key: 'jueves', label: 'Jueves', short: 'Jue' },
  { key: 'viernes', label: 'Viernes', short: 'Vie' },
];

export interface ServerSlot {
  id: number | string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
}

export interface CourseSchedule {
  curso_id: string;
  curso_nombre: string;
  color: string;
  slots: ServerSlot[];
}

export interface EditableSlot extends ServerSlot {
  curso_id: string;
  curso_nombre: string;
  color: string;
  pending: boolean;
  editing?: boolean;
}

export interface GridSlot {
  id: number | string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  curso_nombre: string;
  color: string;
  aula: string | null;
}

export function buildHourTicks(
  startHour = 8,
  endHour = 15,
  stepMinutes = 30,
): string[] {
  const out: string[] = [];
  const startTotal = startHour * 60;
  const endTotal = endHour * 60 + stepMinutes;

  for (let m = startTotal; m <= endTotal; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return out;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snapDown(totalMin: number, step = 30): number {
  return Math.floor(totalMin / step) * step;
}

export const PX_PER_MIN = 2.4;
export const TICK_STEP_MIN = 30;
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 15 * 60 + 30;