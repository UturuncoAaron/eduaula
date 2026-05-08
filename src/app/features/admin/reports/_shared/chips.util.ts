import type {
  CategoriaRendimiento,
  EscalaCalificacion,
  EstadoAsistenciaDocente,
} from '../../../../core/models/reports';

const ESCALA_CHIP: Record<string, string> = {
  AD: 'chip-ad',
  A: 'chip-a',
  B: 'chip-b',
  C: 'chip-c',
};

const CATEGORIA_CHIP: Record<string, string> = {
  top: 'chip-ad',
  normal: 'chip-b',
  riesgo: 'chip-c',
  'sin-datos': 'chip-sin',
};

const ESTADO_DOCENTE_CHIP: Record<string, string> = {
  presente: 'chip-ad',
  tardanza: 'chip-b',
  ausente: 'chip-c',
  permiso: 'chip-sin',
  licencia: 'chip-sin',
  'sin-registro': 'chip-sin',
};

const ESTADO_DOCENTE_LABEL: Record<string, string> = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  ausente: 'Ausente',
  permiso: 'Permiso',
  licencia: 'Licencia',
  'sin-registro': 'Sin reg.',
};

export function escalaChip(e: EscalaCalificacion | string | null): string {
  return ESCALA_CHIP[e ?? ''] ?? 'chip-sin';
}

export function categoriaChip(c: CategoriaRendimiento | string): string {
  return CATEGORIA_CHIP[c] ?? 'chip-sin';
}

export function estadoDocenteChip(e: EstadoAsistenciaDocente | string): string {
  return ESTADO_DOCENTE_CHIP[e] ?? 'chip-sin';
}

export function estadoDocenteLabel(e: EstadoAsistenciaDocente | string): string {
  return ESTADO_DOCENTE_LABEL[e] ?? e;
}

export function nombreCompleto(r: {
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
}): string {
  return [r.apellido_paterno, r.apellido_materno, r.nombre].filter(Boolean).join(' ');
}
