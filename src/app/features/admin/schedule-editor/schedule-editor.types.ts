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

/** Estructura de períodos del colegio: 9 bloques de 45 min + 2 recreos */
export interface PeriodTick {
  time: string;       // "HH:MM"
  isBreak: boolean;   // true = recreo, no seleccionable en modal
  label?: string;     // etiqueta opcional para recreos
}

export const PERIOD_TICKS: PeriodTick[] = [
  { time: '08:00', isBreak: false },
  { time: '08:45', isBreak: false },
  { time: '09:30', isBreak: false },
  { time: '10:15', isBreak: false },
  { time: '11:00', isBreak: true, label: 'Recreo' },
  { time: '11:15', isBreak: false },
  { time: '12:00', isBreak: false },
  { time: '12:45', isBreak: false },
  { time: '13:30', isBreak: true, label: 'Refrigerio' },
  { time: '14:00', isBreak: false },
  { time: '14:45', isBreak: false },
  { time: '15:30', isBreak: false }, // fin del día
];

/** Retorna solo los ticks permitidos para inicio/fin de bloque (excluye recreos) */
export function buildHourTicks(includeBreaksAsFin = false): string[] {
  return PERIOD_TICKS
    .filter(p => includeBreaksAsFin ? true : !p.isBreak)
    .map(p => p.time);
}

/** Retorna todos los ticks como strings para el grid visual */
export function buildAllTicks(): string[] {
  return PERIOD_TICKS.map(p => p.time);
}

/** Convierte "HH:MM" a minutos totales desde medianoche */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos totales a string "HH:MM" */
export function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Redondea hacia abajo al tick de período más cercano (usado para snap en el grid) */
export function snapDown(totalMin: number, step = 30): number {
  return Math.floor(totalMin / step) * step;
}

/** Snap al tick de PERIOD_TICKS más cercano hacia abajo */
export function snapToNearestPeriod(clickedMin: number): number {
  const ticks = PERIOD_TICKS.map(p => toMinutes(p.time));
  return ticks.reduce((best, t) => t <= clickedMin ? t : best, ticks[0]);
}

export const PX_PER_MIN = 2.4;
export const TICK_STEP_MIN = 45;
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 15 * 60 + 30;