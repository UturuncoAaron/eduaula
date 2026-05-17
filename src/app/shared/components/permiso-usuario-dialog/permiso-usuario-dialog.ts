import {
  Component, inject, signal, computed, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

interface DialogData {
  id: string;
  nombre: string;
  apellido_paterno: string;
  rol: string;
}

interface PermisoItem {
  modulo: string;
  accion: string;
  label: string;
  descripcion: string;
  sensitive?: boolean;
}

interface PermisoExtra {
  id: string;
  cuentaId: string;
  modulo: string;
  accion: string;
  activo: boolean;
}

type PendingOp =
  | { type: 'grant'; item: PermisoItem }
  | { type: 'revoke'; item: PermisoItem; permisoId: string };

const PERMISOS_POR_ROL: Record<string, PermisoItem[]> = {
  psicologa: [
    {
      modulo: 'comunicados', accion: 'crear',
      label: 'Crear comunicados',
      descripcion: 'Publicar comunicados institucionales.',
    },
    {
      modulo: 'reports', accion: 'export',
      label: 'Exportar reportes',
      descripcion: 'Descargar reportes académicos en Excel/PDF.',
    },
    {
      modulo: 'reportes', accion: 'ver_todos',
      label: 'Ver reportes globales',
      descripcion: 'Acceso a reportes de todos los alumnos.',
      sensitive: true,
    },
  ],
  docente: [
    {
      modulo: 'comunicados', accion: 'crear',
      label: 'Crear comunicados',
      descripcion: 'Publicar comunicados institucionales.',
    },
    {
      modulo: 'libretas', accion: 'subir',
      label: 'Subir libretas',
      descripcion: 'Cargar libretas PDF de alumnos.',
    },
    {
      modulo: 'libretas', accion: 'subir_padre',
      label: 'Subir libreta del padre',
      descripcion: 'Subir la libreta UGEL dirigida al padre.',
      sensitive: true,
    },
    {
      modulo: 'notas', accion: 'editar_retroactivo',
      label: 'Editar notas retroactivas',
      descripcion: 'Modificar notas de periodos ya cerrados.',
      sensitive: true,
    },
    {
      modulo: 'asistencias_curso', accion: 'editar_retroactivo',
      label: 'Editar asistencia retroactiva',
      descripcion: 'Modificar asistencia de fechas pasadas.',
      sensitive: true,
    },
    {
      modulo: 'reports', accion: 'export',
      label: 'Exportar reportes',
      descripcion: 'Descargar reportes académicos en Excel/PDF.',
    },
    {
      modulo: 'reportes', accion: 'ver_todos',
      label: 'Ver reportes globales',
      descripcion: 'Acceso a reportes de todos los alumnos.',
      sensitive: true,
    },
  ],
};

@Component({
  selector: 'app-permiso-usuario-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule, MatIconModule, MatButtonModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './permiso-usuario-dialog.html',
  styleUrl: './permiso-usuario-dialog.scss',
})
export class PermisoUsuarioDialog implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<PermisoUsuarioDialog>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  loading = signal(true);
  saving = signal(false);
  permisos = signal<PermisoExtra[]>([]);
  pendingOps = signal<PendingOp[]>([]);

  // Inicializado en constructor para asegurar que data ya está disponible
  readonly items: PermisoItem[];

  readonly hasPending = computed(() => this.pendingOps().length > 0);
  readonly pendingCount = computed(() => this.pendingOps().length);

  constructor() {

    this.items = PERMISOS_POR_ROL[this.data?.rol] ?? [];
  }
  ngOnInit() { this.cargar(); }

  private cargar() {
    this.loading.set(true);
    this.api.get<PermisoExtra[]>(`permissions/cuenta/${this.data.id}`).subscribe({
      next: r => {
        this.permisos.set(((r as any).data ?? []).filter((p: PermisoExtra) => p.activo));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  tienePermiso(item: PermisoItem): boolean {
    const base = this.permisos().some(
      p => p.modulo === item.modulo && p.accion === item.accion
    );
    const pending = this.pendingOps().find(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion
    );
    if (!pending) return base;
    return pending.type === 'grant';
  }

  isPending(item: PermisoItem): boolean {
    return this.pendingOps().some(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion
    );
  }

  toggle(item: PermisoItem, checked: boolean) {
    if (checked && item.sensitive) {
      const ok = confirm(
        `Permiso sensible: "${item.label}"\n${item.descripcion}\n\n¿Confirmar?`
      );
      if (!ok) return;
    }
    const existente = this.permisos().find(
      p => p.modulo === item.modulo && p.accion === item.accion
    );
    const ops = this.pendingOps().filter(
      op => !(op.item.modulo === item.modulo && op.item.accion === item.accion)
    );
    if (checked && !existente) ops.push({ type: 'grant', item });
    else if (!checked && existente) ops.push({ type: 'revoke', item, permisoId: existente.id });
    this.pendingOps.set(ops);
  }

  guardar() {
    const ops = this.pendingOps();
    if (!ops.length) return;
    this.saving.set(true);

    const requests = ops.map(op =>
      op.type === 'grant'
        ? this.api.post('permissions', {
          cuentaId: this.data.id,
          modulo: op.item.modulo,
          accion: op.item.accion,
        }).pipe(map(() => true), catchError(() => of(false)))
        : this.api.delete(`permissions/${op.permisoId}`)
          .pipe(map(() => true), catchError(() => of(false)))
    );

    forkJoin(requests).subscribe({
      next: results => {
        const ok = results.filter(Boolean).length;
        const fail = results.length - ok;
        if (ok) this.toastr.success(`${ok} permiso(s) actualizado(s)`, 'Éxito');
        if (fail) this.toastr.error(`${fail} permiso(s) fallaron`, 'Error');
        this.pendingOps.set([]);
        this.saving.set(false);
        this.cargar();
      },
    });
  }

  cerrar() { this.dialogRef.close(); }
}