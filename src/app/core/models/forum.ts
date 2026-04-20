export interface Forum {
    id: string;
    curso_id: string;
    titulo: string;
    descripcion: string | null;
    activo: boolean;
    created_at: string;
}

export interface ForumPost {
    id: string;
    foro_id: string;
    contenido: string;
    parent_post_id: string | null;
    activo: boolean;
    created_at: string;
    updated_at: string;
    usuario: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        rol: string;
    };
}

export interface ForumThread {
    forum: Forum;
    posts: ForumPost[];
}