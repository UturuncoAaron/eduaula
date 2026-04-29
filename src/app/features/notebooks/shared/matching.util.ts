import type { AlumnoTutoria } from '../tutoring.types';

export type MatchConfidence = 'high' | 'medium' | 'none';

export interface MatchResult {
    alumno: AlumnoTutoria | null;
    score: number;
    confidence: MatchConfidence;
}

const HIGH_THRESHOLD = 0.66;
const MEDIUM_THRESHOLD = 0.40;

function normalize(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[._\-+]/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(s: string): string[] {
    return normalize(s)
        .split(' ')
        .filter(t => t.length >= 2 && !/^\d+$/.test(t));
}

export function matchScore(filename: string, alumno: AlumnoTutoria): number {
    const fileTokens = new Set(tokenize(filename));
    const nameTokens = tokenize(
        `${alumno.nombre} ${alumno.apellido_paterno} ${alumno.apellido_materno ?? ''}`,
    );
    if (nameTokens.length === 0 || fileTokens.size === 0) return 0;

    let hits = 0;
    for (const t of nameTokens) {
        if (fileTokens.has(t)) hits++;
    }
    return hits / nameTokens.length;
}

export function bestMatch(filename: string, alumnos: AlumnoTutoria[]): MatchResult {
    let best: { alumno: AlumnoTutoria; score: number } | null = null;

    for (const a of alumnos) {
        const score = matchScore(filename, a);
        if (!best || score > best.score) best = { alumno: a, score };
    }

    if (!best) {
        return { alumno: null, score: 0, confidence: 'none' };
    }

    let confidence: MatchConfidence = 'none';
    if (best.score >= HIGH_THRESHOLD) confidence = 'high';
    else if (best.score >= MEDIUM_THRESHOLD) confidence = 'medium';

    return {
        alumno: confidence === 'none' ? null : best.alumno,
        score: best.score,
        confidence,
    };
}