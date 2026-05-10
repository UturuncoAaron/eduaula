export type CalendarMode = 'schedule' | 'availability' | 'booking' | 'editor';

export type CalendarEventType =
    | 'course'        // clase del horario académico
    | 'appointment'   // cita agendada
    | 'available'     // slot disponible para agendar
    | 'taken'         // slot ocupado
    | 'event';        // evento institucional

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
    startTime: string;   // 'HH:mm'
    endTime: string;     // 'HH:mm'
    diaSemana: DiaSemana | string;
    color?: string;
    meta?: Record<string, unknown>;
}

export interface CalendarDayEvent {
    date: string;        // 'YYYY-MM-DD'
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