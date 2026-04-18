export type Rol = 'alumno' | 'docente' | 'admin' | 'padre';
export type TipoDoc = 'dni' | 'ce' | 'pasaporte';

export interface User {
    id: string;
    tipo_documento: TipoDoc;
    numero_documento: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string;
    rol: Rol;
    foto_url?: string | null;
    // alumno
    codigo_estudiante?: string;
    // docente
    especialidad?: string;
    // padre
    relacion_familiar?: string;
    // admin
    cargo?: string;
}

export interface LoginPayload {
    tipo_documento: TipoDoc;
    numero_documento: string;
    password: string;
}

export interface LoginResponse {
    data: {
        token: string;
        user: User;
    };
}