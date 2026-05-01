export interface PsychologistProfile {
    id: string;
    userId: string;
    specialty: string;
    // ... otros campos de la tabla psicologa_perfil
}

export interface AssignedStudent {
    id: string;
    studentId: string;
    names: string;
    grade: string;
    section: string;
    lastSessionDate?: string;
    status: 'active' | 'discharged';
}

export interface Appointment {
    id: string;
    date: string;
    timeSlot: string;
    type: 'student' | 'parent';
    participantName: string;
    status: 'scheduled' | 'completed' | 'cancelled';
}