export const MODULO = {
  // ── Comunes
  DASHBOARD:         'dashboard',
  COMUNICADOS:       'comunicados',
  MENSAJES:          'mensajes',
  NOTIFICACIONES:    'notificaciones',
  PERFIL:            'perfil',

  // ── Alumno
  MIS_CURSOS:        'mis_cursos',
  MIS_TAREAS:        'mis_tareas',
  MIS_NOTAS:         'mis_notas',
  MI_ASISTENCIA:     'mi_asistencia',
  MIS_LIBRETAS:      'mis_libretas',
  MIS_CITAS:         'mis_citas',

  // ── Docente
  CURSOS_DOCENTE:    'cursos_docente',
  NOTAS_CURSO:       'notas_curso',
  ASIST_CURSO:       'asist_curso',
  TAREAS_GESTIONAR:  'tareas_gestionar',
  MATERIALES:        'materiales',

  // ── Alumno + Docente
  FORO:              'foro',
  CLASES_VIVO:       'clases_vivo',

  // ── Tutor (docente con secciones.tutor_id)
  TUTORIA:           'tutoria',
  ASIST_GENERAL:     'asist_general',

  // ── Padre
  HIJOS:             'hijos',
  LIBRETAS_HIJOS:    'libretas_hijos',
  CITAS_AGENDADAS:   'citas_agendadas',

  // ── Psicóloga
  CASOS:             'casos',
  CITAS:             'citas',
  FICHAS:            'fichas',
  DISPONIBILIDAD:    'disponibilidad',

  // ── Admin
  USUARIOS:          'usuarios',
  PERIODOS:          'periodos',
  GRADOS_SECCIONES:  'grados_secciones',
  CURSOS_ADMIN:      'cursos_admin',
  MATRICULAS:        'matriculas',
  PADRE_HIJO_ADMIN:  'padre_hijo',
  REPORTES_GLOBALES: 'reportes_globales',
  COMUNICADOS_ADMIN: 'comunicados_admin',
  IMPORTAR:          'importar',
  AJUSTES:           'ajustes',
} as const;

export type Modulo = (typeof MODULO)[keyof typeof MODULO];
export function hasModulo(userModulos: string[] | undefined, m: Modulo): boolean {
  return !!userModulos?.includes(m);
}
export function hasAnyModulo(userModulos: string[] | undefined, ms: Modulo[]): boolean {
  if (!userModulos?.length) return false;
  const set = new Set(userModulos);
  return ms.some(m => set.has(m));
}
