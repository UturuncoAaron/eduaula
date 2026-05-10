import {
    AccountAvailability, DiaSemana, SlotTaken,
} from '../../core/models/appointments';
import { CalendarSlot } from '../components/calendar-grid/calendar-grid.types';
import {
    addDaysDate, dayIdxToKey, formatHM, parseHM, parseLocalDate,
} from './calendar-week';

const SLOT_MINUTES = 30;
export function buildBookingSlots(
    availability: AccountAvailability[],
    taken: SlotTaken[],
    weekStart: string,
): CalendarSlot[] {
    const slots: CalendarSlot[] = [];
    const indexByKey = new Map<string, number>();

    for (const av of availability) {
        if (!av.activo) continue;
        const startMin = parseHM(av.horaInicio);
        const endMin = parseHM(av.horaFin);
        for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
            addOrReplace(slots, indexByKey, {
                id: `av-${av.id}-${formatHM(m)}`,
                title: 'Disponible',
                type: 'available',
                startTime: formatHM(m),
                endTime: formatHM(m + SLOT_MINUTES),
                diaSemana: av.diaSemana,
            });
        }
    }

    const wsDate = parseLocalDate(weekStart);
    const weDate = addDaysDate(wsDate, 7);
    for (const t of taken) {
        const d = new Date(t.scheduledAt);
        if (d < wsDate || d >= weDate) continue;
        const dia = dayIdxToKey(d.getDay());
        if (!dia) continue;
        const minutes = d.getHours() * 60 + d.getMinutes();
        const dur = t.durationMin ?? SLOT_MINUTES;
        for (let m = minutes; m < minutes + dur; m += SLOT_MINUTES) {
            addOrReplace(slots, indexByKey, {
                id: `taken-${t.id}-${formatHM(m)}`,
                title: 'Ocupado',
                type: 'taken',
                startTime: formatHM(m),
                endTime: formatHM(m + SLOT_MINUTES),
                diaSemana: dia as DiaSemana,
            });
        }
    }

    return slots;
}

function addOrReplace(
    slots: CalendarSlot[],
    index: Map<string, number>,
    slot: CalendarSlot,
): void {
    const key = `${slot.diaSemana}__${slot.startTime}`;
    const existing = index.get(key);
    if (existing !== undefined) {
        slots[existing] = slot;
    } else {
        index.set(key, slots.length);
        slots.push(slot);
    }
}