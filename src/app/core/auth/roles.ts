import type { Rol } from '../models/user';

export type MacroRol = 'alumno' | 'padre' | 'staff';

export const STAFF_ROLES = [
  'admin',
  'docente',
  'staff',
  'psicologa',
] as const satisfies readonly Rol[];

export type StaffRol = (typeof STAFF_ROLES)[number];

export function getMacroRol(rol: Rol | null | undefined): MacroRol | null {
  if (!rol) return null;
  if (rol === 'alumno') return 'alumno';
  if (rol === 'padre') return 'padre';
  return 'staff';
}

export function isStaffRol(rol: Rol | null | undefined): rol is StaffRol {
  return !!rol && (STAFF_ROLES as readonly Rol[]).includes(rol);
}