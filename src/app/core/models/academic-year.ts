/**
 * Modelo de Año Lectivo.
 *
 * Refleja la entidad `anios_lectivos` del backend, fuente única de verdad
 * para el ciclo de vida anual del colegio (planificado → en_curso →
 * cerrado → archivado). Las matrículas, la promoción automática y la
 * desactivación de cuentas de egresados cuelgan de aquí.
 */

export type AcademicYearStatus =
    | 'planificado'
    | 'en_curso'
    | 'cerrado'
    | 'archivado';

export interface AcademicYear {
    id: string;
    anio: number;
    fechaInicio: string;
    fechaFin: string;
    estado: AcademicYearStatus;
    promocionEjecutadaAt: string | null;
    egresadosDesactivadosAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAcademicYearPayload {
    anio: number;
    fechaInicio: string;
    fechaFin: string;
}

/**
 * Resultado del endpoint `GET /academic-years/:anio/promotion/preview`.
 * Permite mostrar al admin qué va a pasar ANTES de ejecutar la promoción.
 */
export interface PromotionPreviewRow {
    matriculaId: string;
    cuentaId: string;
    nombre: string;
    gradoActual: number;
    seccionActual: string | null;
    condicionFinal: 'pendiente' | 'aprobado' | 'desaprobado' | 'retirado';
    esEgresado: boolean;
    yaPromovido: boolean;
}

export interface PromotionPreview {
    anio: number;
    totalAprobados: number;
    totalEgresados: number;
    totalRepetidores: number;
    totalSinDestino: number;
    rows: PromotionPreviewRow[];
}

export interface PromotionResult {
    creadas: number;
    egresados: number;
    repetidores: number;
}

export interface EgresadoDeactivationResult {
    desactivados: number;
}

export type CondicionFinal =
    | 'pendiente'
    | 'aprobado'
    | 'desaprobado'
    | 'retirado';

export interface SetCondicionFinalPayload {
    condicionFinal: CondicionFinal;
}
