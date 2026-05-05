export type TipoDocumento = 'dni' | 'ce' | 'pasaporte';
export type Rol = 'alumno' | 'docente' | 'admin' | 'padre' | 'psicologa' | 'auxiliar';
export interface SeccionTutorada {
    id: string;
    nombre: string;
}

export interface User {
    id: string;
    tipo_documento: TipoDocumento;
    numero_documento: string;
    codigo_acceso: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    foto_url: string | null;
    rol: Rol;
    activo: boolean;
    password_changed: boolean;
    email: string | null;
    telefono: string | null;
    codigo_estudiante: string | null;
    fecha_nacimiento: string | null;
    grado?: string | null;
    seccion?: string | null;
    especialidad: string | null;
    titulo_profesional: string | null;
    relacion_familiar: string | null;
    cargo: string | null;
    colegiatura?: string | null;
    modulos: string[];
    es_tutor_de: SeccionTutorada[];
    created_at?: string | null;
}

export interface LoginPayload {
    codigo_acceso: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    data: {
        token: string;
        password_changed: boolean;
        user: User;
    };
}

export interface ChangePasswordPayload {
    current_password: string;
    new_password: string;
}
