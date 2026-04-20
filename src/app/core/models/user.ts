// src/app/core/models/user.ts

export type TipoDocumento = 'dni' | 'ce' | 'pasaporte';
export type Rol = 'alumno' | 'docente' | 'admin' | 'padre';

export interface User {
    id: string;
    tipo_documento: TipoDocumento;
    numero_documento: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    foto_url: string | null;
    rol: Rol;
    activo: boolean;
    email: string | null;
    telefono: string | null;
    codigo_estudiante: string | null;
    fecha_nacimiento: string | null;
    especialidad: string | null;
    titulo_profesional: string | null;
    relacion_familiar: string | null;
    cargo: string | null;
}

export interface LoginPayload {
    tipo_documento: TipoDocumento;
    numero_documento: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    data: {
        token: string;
        user: User;
    };
}