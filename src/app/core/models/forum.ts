export interface Forum {
    id: string;
    curso_id: string;
    titulo: string;
    descripcion: string | null;
    bimestre?: number | null;
    semana?: number | null;
    activo: boolean;
    oculto?: boolean;
    created_at: string;
}

export interface ForumPostAuthor {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string;
    rol: string;
}

export interface ForumPost {
    id: string;
    foro_id: string;
    contenido: string;
    parent_post_id: string | null;
    activo: boolean;
    created_at: string;
    updated_at: string;
    usuario?: ForumPostAuthor;
    respuestas?: ForumPost[];
}

export interface ForumThread {
    forum: Forum;
    posts: ForumPost[];
}