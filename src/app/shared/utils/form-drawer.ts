import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Tamaños estandarizados del drawer de formulario.
 *
 * Todos los tamaños usan unidades viewport (`vw`) para garantizar que el
 * panel ocupe siempre al menos el 80% de la pantalla, sin importar la
 * resolución. En móvil (≤600px) styles.scss fuerza 100vw con su media query.
 *
 * - `sm`  → 85vw  (formularios mínimos: confirmaciones)
 * - `md`  → 90vw  (default; foros, materiales, edición, videoconferencia)
 * - `lg`  → 95vw  (formularios complejos con grids de varias columnas:
 *                  crear tarea, configuraciones avanzadas)
 */
export type FormDrawerSize = 'sm' | 'md' | 'lg';

const FORM_DRAWER_WIDTH: Record<FormDrawerSize, string> = {
    sm: '85vw',
    md: '90vw',
    lg: '95vw',
};

/**
 * Devuelve la configuración estándar para abrir un formulario como drawer
 * lateral derecho con `MatDialog`.
 *
 * Comparte el mismo patrón visual que `material-preview-pane` (slide-in
 * desde la derecha, full height, sin border-radius) pero más angosto y
 * pensado para formularios. La animación viene del panelClass
 * `form-drawer-pane` definido en `styles.scss`.
 *
 * Uso:
 * ```ts
 * import { formDrawerConfig } from 'src/app/shared/utils/form-drawer';
 *
 * this.dialog.open(MyForm, formDrawerConfig({ courseId }, 'md'));
 * ```
 *
 * Centralizar esta config evita duplicar `width/height/position/panelClass`
 * en cada call site y mantiene el comportamiento uniforme. Si en el futuro
 * el equipo quiere ajustar la animación o el ancho, hay un único punto.
 */
export function formDrawerConfig<T>(
    data: T,
    size: FormDrawerSize = 'md',
): MatDialogConfig<T> {
    return {
        data,
        width: FORM_DRAWER_WIDTH[size],
        maxWidth: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        position: { right: '0', top: '0' },
        panelClass: 'form-drawer-pane',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        enterAnimationDuration: 0,
        exitAnimationDuration: 0,
    };
}
