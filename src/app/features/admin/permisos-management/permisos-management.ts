import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from 'ngx-toastr-notifier';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';

interface CuentaResumen {
  id: string;
  nombre: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  email?: string;
  rol: string;
}

interface PermisoExtra {
  id: string;
  cuentaId: string;
  modulo: string;
  accion: string;
  activo: boolean;
  createdAt: string;
}

/**
 * Catálogo de permisos otorgables, agrupados por módulo.
 * Las entradas marcadas con `sensitive` muestran un confirm extra antes de
 * aplicarse en el guardado en lote.
 */
interface PermisoCatalogoItem {
  modulo: string;
  accion: string;
  label: string;
  descripcion: string;
  sensitive?: boolean;
}

interface PermisoGrupo {
  modulo: string;
  label: string;
  items: PermisoCatalogoItem[];
}

const PERMISOS_CATALOGO: PermisoGrupo[] = [
  {
    modulo: 'libretas',
    label: 'Libretas',
    items: [
      {
        modulo: 'libretas',
        accion: 'subir_padre',
        label: 'Subir libreta del padre',
        descripcion: 'Permite subir la libreta UGEL dirigida al padre. Sensible: solo cuenta designada por dirección.',
        sensitive: true,
      },
      {
        modulo: 'libretas',
        accion: 'subir',
        label: 'Subir libretas',
        descripcion: 'Habilita la carga de libretas PDF (docente designado).',
      },
    ],
  },
  {
    modulo: 'reports',
    label: 'Reportes',
    items: [
      {
        modulo: 'reports',
        accion: 'export',
        label: 'Exportar reportes',
        descripcion: 'Descarga de reportes académicos y de asistencias en PDF y Excel.',
      },
      {
        modulo: 'reportes',
        accion: 'ver_todos',
        label: 'Ver reportes globales',
        descripcion: 'Acceso a reportes de todos los alumnos (no solo del propio curso).',
        sensitive: true,
      },
    ],
  },
  {
    modulo: 'asistencias',
    label: 'Asistencias',
    items: [
      {
        modulo: 'asistencias',
        accion: 'docentes',
        label: 'Tomar asistencia a docentes',
        descripcion: 'Registrar asistencia diaria de docentes (auxiliares).',
      },
      {
        modulo: 'asistencias_general',
        accion: 'editar_retroactivo',
        label: 'Editar asistencia general retroactiva',
        descripcion: 'Modificar registros de asistencia general de fechas pasadas.',
        sensitive: true,
      },
      {
        modulo: 'asistencias_curso',
        accion: 'editar_retroactivo',
        label: 'Editar asistencia por curso retroactiva',
        descripcion: 'Modificar registros de asistencia por curso de fechas pasadas.',
        sensitive: true,
      },
    ],
  },
  {
    modulo: 'notas',
    label: 'Calificaciones',
    items: [
      {
        modulo: 'notas',
        accion: 'editar_retroactivo',
        label: 'Editar notas retroactivas',
        descripcion: 'Cambiar notas de periodos académicos ya cerrados.',
        sensitive: true,
      },
    ],
  },
  {
    modulo: 'comunicados',
    label: 'Comunicación',
    items: [
      {
        modulo: 'comunicados',
        accion: 'crear',
        label: 'Crear comunicados',
        descripcion: 'Publicar comunicados (no requiere rol admin).',
      },
    ],
  },
  {
    modulo: 'usuarios',
    label: 'Usuarios',
    items: [
      {
        modulo: 'usuarios',
        accion: 'gestionar',
        label: 'Gestionar usuarios',
        descripcion: 'Crear, editar y desactivar cuentas. Sensible: equivale a admin parcial.',
        sensitive: true,
      },
    ],
  },
];

const ROLES_OTORGABLES = ['docente', 'auxiliar', 'admin'] as const;

type PendingOp =
  | { type: 'grant'; item: PermisoCatalogoItem }
  | { type: 'revoke'; item: PermisoCatalogoItem; permisoId: string };

@Component({
  selector: 'app-permisos-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permisos-management.html',
  styleUrl: './permisos-management.scss',
})
export class PermisosManagement implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalogo = PERMISOS_CATALOGO;
  readonly rolesOtorgables = ROLES_OTORGABLES;

  readonly loadingCuentas = signal(true);
  readonly cuentas = signal<CuentaResumen[]>([]);
  readonly filtroRol = signal<string>('docente');
  readonly query = signal<string>('');
  private readonly querySubject = new Subject<string>();

  readonly cuentaSeleccionada = signal<CuentaResumen | null>(null);
  readonly permisosCuenta = signal<PermisoExtra[]>([]);
  readonly loadingPermisos = signal(false);
  readonly savingChanges = signal(false);

  /** Cambios pendientes (no aplicados aún en el backend). */
  readonly pendingOps = signal<PendingOp[]>([]);

  readonly cuentasFiltradas = computed(() => {
    const q = this.query().toLowerCase().trim();
    const rol = this.filtroRol();
    return this.cuentas().filter(c => {
      if (rol && c.rol !== rol) return false;
      if (!q) return true;
      const full = `${c.nombre} ${c.apellido_paterno ?? ''} ${c.apellido_materno ?? ''} ${c.email ?? ''}`.toLowerCase();
      return full.includes(q);
    });
  });

  readonly pendingCount = computed(() => this.pendingOps().length);
  readonly hasPending = computed(() => this.pendingOps().length > 0);

  constructor() {
    this.querySubject
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(q => this.query.set(q));

    // Si el usuario cambia de cuenta sin guardar, descartamos pendientes.
    effect(() => {
      this.cuentaSeleccionada();
      this.pendingOps.set([]);
    });
  }

  ngOnInit() {
    this.loadCuentas();
  }

  onSearchInput(value: string) {
    this.querySubject.next(value);
  }

  /** Carga la lista completa de cuentas con roles otorgables. */
  private loadCuentas() {
    this.api.get<CuentaResumen[]>('admin/users').subscribe({
      next: r => {
        const data = (r.data ?? []).filter(c => (ROLES_OTORGABLES as readonly string[]).includes(c.rol));
        this.cuentas.set(data);
        this.loadingCuentas.set(false);
      },
      error: () => {
        this.cuentas.set([]);
        this.loadingCuentas.set(false);
        this.toastr.error('No se pudieron cargar las cuentas');
      },
    });
  }

  onPickCuenta(c: CuentaResumen) {
    if (this.hasPending() && this.cuentaSeleccionada()?.id !== c.id) {
      if (!confirm('Tenés cambios pendientes que se perderán. ¿Cambiar de cuenta igual?')) return;
    }
    this.cuentaSeleccionada.set(c);
    this.loadPermisos(c.id);
  }

  private loadPermisos(cuentaId: string) {
    this.loadingPermisos.set(true);
    this.api.get<PermisoExtra[]>(`permissions/cuenta/${cuentaId}`).subscribe({
      next: r => {
        this.permisosCuenta.set((r.data ?? []).filter(p => p.activo));
        this.loadingPermisos.set(false);
      },
      error: () => {
        this.permisosCuenta.set([]);
        this.loadingPermisos.set(false);
      },
    });
  }

  /** Estado efectivo (permisos del servidor + cambios pendientes) de un permiso. */
  tienePermiso(item: PermisoCatalogoItem): boolean {
    const base = this.permisosCuenta().some(
      p => p.modulo === item.modulo && p.accion === item.accion,
    );
    const pending = this.pendingOps().find(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion,
    );
    if (!pending) return base;
    return pending.type === 'grant';
  }

  isPending(item: PermisoCatalogoItem): boolean {
    return this.pendingOps().some(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion,
    );
  }

  togglePermiso(item: PermisoCatalogoItem, granted: boolean) {
    const cuenta = this.cuentaSeleccionada();
    if (!cuenta) return;

    if (granted && item.sensitive) {
      const ok = confirm(
        `Vas a otorgar un permiso sensible: "${item.label}".\n${item.descripcion}\n\n¿Confirmás?`,
      );
      if (!ok) return;
    }

    const existente = this.permisosCuenta().find(
      p => p.modulo === item.modulo && p.accion === item.accion,
    );

    // Si la operación deshace un cambio anterior, simplemente la quitamos.
    const ops = this.pendingOps().filter(
      op => !(op.item.modulo === item.modulo && op.item.accion === item.accion),
    );

    if (granted && !existente) {
      ops.push({ type: 'grant', item });
    } else if (!granted && existente) {
      ops.push({ type: 'revoke', item, permisoId: existente.id });
    }
    this.pendingOps.set(ops);
  }

  discardChanges() {
    this.pendingOps.set([]);
  }

  saveChanges() {
    const cuenta = this.cuentaSeleccionada();
    const ops = this.pendingOps();
    if (!cuenta || ops.length === 0) return;

    this.savingChanges.set(true);

    const requests = ops.map(op => {
      if (op.type === 'grant') {
        return this.api.post('permissions', {
          cuentaId: cuenta.id,
          modulo: op.item.modulo,
          accion: op.item.accion,
        }).pipe(
          map(() => ({ ok: true, op })),
          catchError(() => of({ ok: false, op })),
        );
      }
      return this.api.delete(`permissions/${op.permisoId}`).pipe(
        map(() => ({ ok: true, op })),
        catchError(() => of({ ok: false, op })),
      );
    });

    forkJoin(requests).subscribe({
      next: results => {
        const okCount = results.filter(r => r.ok).length;
        const failCount = results.length - okCount;
        if (okCount > 0) this.toastr.success(`${okCount} cambio(s) aplicado(s)`);
        if (failCount > 0) this.toastr.error(`${failCount} cambio(s) fallaron`);
        this.pendingOps.set([]);
        this.savingChanges.set(false);
        this.loadPermisos(cuenta.id);
      },
      error: () => {
        this.savingChanges.set(false);
        this.toastr.error('No se pudieron aplicar los cambios');
      },
    });
  }

  rolBadge(rol: string): string {
    if (rol === 'docente') return 'school';
    if (rol === 'auxiliar') return 'support_agent';
    if (rol === 'admin') return 'admin_panel_settings';
    return 'person';
  }

  rolLabel(rol: string): string {
    if (rol === 'docente') return 'Docente';
    if (rol === 'auxiliar') return 'Auxiliar';
    if (rol === 'admin') return 'Admin';
    return rol;
  }

  fullName(c: CuentaResumen): string {
    return [c.nombre, c.apellido_paterno, c.apellido_materno].filter(Boolean).join(' ');
  }
}
