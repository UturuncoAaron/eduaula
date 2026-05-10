import { DiaSemana } from '../../core/models/appointments';

const DAY_KEYS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

export function getCurrentMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return formatDateLocal(d);
}

export function parseLocalDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysDate(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

export function formatDateLocal(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateFromWeekAndDia(weekStart: string, dia: DiaSemana): Date | null {
    const idx = DAY_KEYS.indexOf(dia);
    if (idx < 0) return null;
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() + idx);
    return d;
}

export function dayIdxToKey(idx: number): DiaSemana | null {
    switch (idx) {
        case 1: return 'lunes';
        case 2: return 'martes';
        case 3: return 'miercoles';
        case 4: return 'jueves';
        case 5: return 'viernes';
        default: return null;
    }
}

export function parseHM(s: string): number {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

export function formatHM(min: number): string {
    return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

export function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

export function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export function combineDateAndTime(date: Date, time: string): Date {
    const [hh, mm] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
    return d;
}

export function diaLabel(d: DiaSemana): string {
    switch (d) {
        case 'lunes': return 'Lunes';
        case 'martes': return 'Martes';
        case 'miercoles': return 'Miércoles';
        case 'jueves': return 'Jueves';
        case 'viernes': return 'Viernes';
        default: return '';
    }
}