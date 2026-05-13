import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from 'ngx-toastr-notifier';
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
 * Catálogo de permisos otorgables.
 * Alumno, padre y psicóloga NO aparecen como candidatos (regla del producto).
 */
interface PermisoCatalogoItem {
  modulo: string;
  accion: string;
  label: string;
  descripcion: string;
}

const PERMISOS_CATALOGO: PermisoCatalogoItem[] = [
  {
    modulo: 'libretas',
    accion: 'subir_padre',
    label: 'Subir libreta del padre',
    descripcion: 'Permite subir la libreta UGEL dirigida al padre (normalmente sólo dirección).',
  },
  {
    modulo: 'reports',
    accion: 'export',
    label: 'Exportar reportes',
    descripcion: 'Habilita la descarga de reportes académicos/asistencias en PDF y Excel.',
  },
  {
    modulo: 'asistencias',
    accion: 'docentes',
    label: 'Tomar asistencia a docentes',
    descripcion: 'Habilita registrar asistencia diaria de docentes (auxiliares).',
  },
];

const ROLES_OTORGABLES = ['docente', 'auxiliar', 'admin'] as const;

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
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permisos-management.html',
  styleUrl: './permisos-management.scss',
})
export class PermisosManagement implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);

  readonly catalogo = PERMISOS_CATALOGO;
  readonly rolesOtorgables = ROLES_OTORGABLES;

  readonly loadingCuentas = signal(true);
  readonly cuentas = signal<CuentaResumen[]>([]);
  readonly filtroRol = signal<string>('docente');
  readonly query = signal<string>('');

  readonly cuentaSeleccionada = signal<CuentaResumen | null>(null);
  readonly permisosCuenta = signal<PermisoExtra[]>([]);
  readonly loadingPermisos = signal(false);

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

  ngOnInit() {
    this.loadCuentas();
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
    this.cuentaSeleccionada.set(c);
    this.loadPermisos(c.id);
  }

  private loadPermisos(cuentaId: string) {
    this.loadingPermisos.set(true);
    this.api.get<PermisoExtra[]>(`permissions/cuenta/${cuentaId}`).subscribe({
      next: r => {
        this.permisosCuenta.set(r.data ?? []);
        this.loadingPermisos.set(false);
      },
      error: () => {
        this.permisosCuenta.set([]);
        this.loadingPermisos.set(false);
      },
    });
  }

  tienePermiso(item: PermisoCatalogoItem): boolean {
    return this.permisosCuenta().some(p => p.modulo === item.modulo && p.accion === item.accion && p.activo);
  }

  togglePermiso(item: PermisoCatalogoItem, granted: boolean) {
    const cuenta = this.cuentaSeleccionada();
    if (!cuenta) return;

    if (granted) {
      this.api.post('permissions', {
        cuentaId: cuenta.id,
        modulo: item.modulo,
        accion: item.accion,
      }).subscribe({
        next: () => {
          this.toastr.success(`Permiso "${item.label}" otorgado`);
          this.loadPermisos(cuenta.id);
        },
        error: () => this.toastr.error('No se pudo otorgar el permiso'),
      });
    } else {
      const existente = this.permisosCuenta().find(p => p.modulo === item.modulo && p.accion === item.accion);
      if (!existente) return;
      this.api.delete(`permissions/${existente.id}`).subscribe({
        next: () => {
          this.toastr.success(`Permiso "${item.label}" revocado`);
          this.loadPermisos(cuenta.id);
        },
        error: () => this.toastr.error('No se pudo revocar el permiso'),
      });
    }
  }

  rolBadge(rol: string): string {
    if (rol === 'docente') return 'school';
    if (rol === 'auxiliar') return 'support_agent';
    if (rol === 'admin') return 'admin_panel_settings';
    return 'person';
  }

  fullName(c: CuentaResumen): string {
    return `${c.nombre} ${c.apellido_paterno ?? ''}`.trim();
  }
}
