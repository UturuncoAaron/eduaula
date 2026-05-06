import type { Rol } from '../models/user';

/**
 * Macro-rol del frontend.
 *
 * El backend tiene 6 roles (`alumno`, `padre`, `admin`, `docente`,
 * `auxiliar`, `psicologa`). En la UI los agrupamos en 3 mundos:
 *
 *  - `alumno` — el estudiante.
 *  - `padre`  — los apoderados.
 *  - `staff`  — admin + docente + auxiliar + psicologa, comparten
 *               el shell de la app y el sidebar; lo que cada staff
 *               ve dentro se filtra por permisos `MODULO`.
 *
 * Esta abstracción es **solo de frontend**: el backend sigue con sus 6 roles.
 */
export type MacroRol = 'alumno' | 'padre' | 'staff';

/** Roles que el frontend trata como "staff" del colegio. */
export const STAFF_ROLES = [
  'admin',
  'docente',
  'auxiliar',
  'psicologa',
] as const satisfies readonly Rol[];

export type StaffRol = (typeof STAFF_ROLES)[number];

/** Devuelve el macro-rol de un rol dado, o `null` si no hay sesión. */
export function getMacroRol(rol: Rol | null | undefined): MacroRol | null {
  if (!rol) return null;
  if (rol === 'alumno') return 'alumno';
  if (rol === 'padre') return 'padre';
  return 'staff';
}

/** True si el rol es uno de los 4 staff. Útil en templates: `isStaff()`. */
export function isStaffRol(rol: Rol | null | undefined): rol is StaffRol {
  return !!rol && (STAFF_ROLES as readonly Rol[]).includes(rol);
}
