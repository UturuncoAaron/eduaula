// Tipos del componente `<app-week-grid>`.
// Es la grilla semanal pixel-perfect compartida entre:
//   - editor de horario (admin)
//   - horario del alumno (read-only)
//   - reserva de cita (booking)
//   - configuración de disponibilidad (psicóloga / docente / director)

export type WeekDia =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado';

export interface WeekDiaInfo {
  /** clave canónica que se usa en el backend. */
  key: WeekDia;
  /** "Lun" — header corto */
  short: string;
  /** "Lunes" — header largo (desktop) */
  long: string;
}

/** Días lunes a viernes. */
export const WEEK_DIAS: readonly WeekDiaInfo[] = [
  { key: 'lunes',     short: 'Lun', long: 'Lunes' },
  { key: 'martes',    short: 'Mar', long: 'Martes' },
  { key: 'miercoles', short: 'Mié', long: 'Miércoles' },
  { key: 'jueves',    short: 'Jue', long: 'Jueves' },
  { key: 'viernes',   short: 'Vie', long: 'Viernes' },
];

/** Slot a renderizar en la grilla. Las posiciones se calculan desde las horas. */
export interface WeekSlot {
  /** ID único para track-by + click. */
  id: string;
  dia: WeekDia;
  /** "HH:mm" */
  horaInicio: string;
  /** "HH:mm" */
  horaFin: string;
  /** Texto principal a mostrar (ej. nombre del curso). */
  title: string;
  /** Línea secundaria (rango horario, docente, etc.). */
  subtitle?: string;
  /** Color de fondo del slot. Si se omite, se usa el default por kind. */
  color?: string;
  /**
   * Tipo del slot — define el estilo y comportamiento.
   * - course: clase del horario académico (azul por defecto, no clickable a menos que el padre habilite).
   * - editor: bloque editable del admin (mismo render que course + cursor pointer).
   * - available: slot disponible para reservar cita (verde, clickable en mode='booking').
   * - taken: slot ya ocupado (gris, no clickable).
   * - blocked: día/franja no disponible (gris atenuado, no clickable).
   * - appointment: cita propia del usuario (color del kind, clickable).
   */
  kind: 'course' | 'editor' | 'available' | 'taken' | 'blocked' | 'appointment';
  /** True si el slot está "pendiente" (no guardado todavía). Activa borde dashed. */
  pending?: boolean;
}

/** Modo de la grilla — define la interacción del click sobre el fondo. */
export type WeekGridMode =
  /** Lectura pura, sin clicks. */
  | 'schedule'
  /** Click en background crea un slot nuevo. Click en slot lo edita. */
  | 'editor'
  /** Click en slot 'available' lo reserva. Click en slot 'taken' o background = no-op. */
  | 'booking'
  /** Click sobre celdas alterna disponibilidad (genera/quita slots 'available'). */
  | 'availability';

export interface WeekGridCellClick {
  dia: WeekDia;
  /** "HH:mm" snappeado al paso (tickStepMin). */
  hora: string;
}

// ── Type guards ────────────────────────────────────────────────
export function isWeekDia(s: unknown): s is WeekDia {
  return (
    s === 'lunes' ||
    s === 'martes' ||
    s === 'miercoles' ||
    s === 'jueves' ||
    s === 'viernes' ||
    s === 'sabado'
  );
}

// ── Helpers de conversión hora ↔ minutos absolutos ─────────────
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snapDown(totalMin: number, step: number): number {
  return Math.floor(totalMin / step) * step;
}

/** Resuelve el lunes de la semana que contiene la fecha dada (YYYY-MM-DD). */
export function getMondayOf(date: string | Date): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  const day = d.getDay(); // 0=Dom, 1=Lun, ...
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
