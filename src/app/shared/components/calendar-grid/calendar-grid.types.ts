export type CalendarMode = 'schedule' | 'availability' | 'booking' | 'editor';

export type CalendarEventType =
  | 'course'
  | 'appointment'
  | 'available'
  | 'taken'
  | 'event';

export type DiaSemana =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes';

export interface CalendarSlot {
  id: string;
  title: string;
  type: CalendarEventType;
  startTime: string;
  endTime: string;
  diaSemana: DiaSemana | string;
  color?: string;
  meta?: Record<string, unknown>;
}

export interface CalendarDayEvent {
  date: string;
  title: string;
  type: CalendarEventType;
  color?: string;
  meta?: Record<string, unknown>;
}

export interface CalendarCellClickEvent {
  diaSemana: string;
  startTime: string;
  endTime: string;
  slot?: CalendarSlot;
}