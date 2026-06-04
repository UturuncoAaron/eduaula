import {
  Component, inject, signal, computed, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

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
  createdAt: string;
  otorgadoPorNombre: string | null;
  ultimaOperacion: 'otorgar' | 'revocar' | null;
}

type PendingOp =
  | { type: 'grant'; item: PermisoItem }
  | { type: 'revoke'; item: PermisoItem; permisoId: string };

const PERMISOS_POR_ROL: Record<string, PermisoItem[]> = {
  docente: [
    {
      modulo: 'comunicados', accion: 'crear',
      label: 'Crear comunicados',
      descripcion: 'Publicar comunicados institucionales visibles para toda la comunidad.',
    },
    {
      modulo: 'libretas', accion: 'subir_padre',
      label: 'Subir libreta del padre',
      descripcion: 'Cargar la libreta UGEL dirigida al padre de familia en el portal de padres.',
      sensitive: true,
    },
    {
      modulo: 'reportes', accion: 'ver_todos',
      label: 'Ver reportes globales',
      descripcion: 'Acceso al tab de reportes de todos los alumnos, no solo sus cursos asignados.',
    },
  ],
  psicologa: [
    {
      modulo: 'comunicados', accion: 'crear',
      label: 'Crear comunicados',
      descripcion: 'Publicar comunicados institucionales visibles para toda la comunidad.',
    },
    {
      modulo: 'reportes', accion: 'ver_todos',
      label: 'Ver reportes globales',
      descripcion: 'Acceso al tab de reportes de todos los alumnos.',
    },
  ],
  staff: [
    {
      modulo: 'asistencias_general', accion: 'registrar',
      label: 'Registrar asistencia general',
      descripcion: 'Permite tomar la asistencia diaria de alumnos por sección y usar el escáner QR.',
    },
    {
      modulo: 'reportes', accion: 'ver_todos',
      label: 'Ver reportes globales',
      descripcion: 'Acceso al módulo de reportes de todos los alumnos.',
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
    DatePipe,
  ],
  templateUrl: './permiso-usuario-dialog.html',
  styleUrl: './permiso-usuario-dialog.scss',
})
export class PermisoUsuarioDialog implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<PermisoUsuarioDialog>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  loading = signal(true);
  saving = signal(false);
  permisos = signal<PermisoExtra[]>([]);
  pendingOps = signal<PendingOp[]>([]);

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
        this.permisos.set((r as any).data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  tienePermiso(item: PermisoItem): boolean {
    const enBd = this.permisos().some(
      p => p.modulo === item.modulo && p.accion === item.accion,
    );
    const pending = this.pendingOps().find(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion,
    );
    if (!pending) return enBd;
    return pending.type === 'grant';
  }

  isPending(item: PermisoItem): boolean {
    return this.pendingOps().some(
      op => op.item.modulo === item.modulo && op.item.accion === item.accion,
    );
  }

  auditoria(item: PermisoItem): PermisoExtra | null {
    return this.permisos().find(
      p => p.modulo === item.modulo && p.accion === item.accion,
    ) ?? null;
  }

  /**
   * Punto de entrada principal para interactuar con un item.
   * Maneja de manera limpia si requiere confirmación o no de forma asíncrona.
   */
  toggle(item: PermisoItem, checked: boolean) {
    if (checked && item.sensitive) {
      this.solicitarConfirmacionSeguridad(item);
    } else {
      this.procesarCambioOperacion(item, checked);
    }
  }

  /**
   * Abre el ConfirmDialogModal de manera asíncrona garantizando consistencia en la UI/UX.
   */
  private solicitarConfirmacionSeguridad(item: PermisoItem) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      width: '400px',
      maxWidth: '90vw',
      autoFocus: false,
      data: {
        title: 'Permiso Sensible',
        message: `¿Estás seguro de que deseas otorgar el permiso "${item.label}"?\n\nDescripción: ${item.descripcion}`,
        btnOkText: 'Confirmar y Activar',
        btnCancelText: 'Cancelar',
        type: 'warning' // Estilizado preventivo si tu modal lo soporta
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.procesarCambioOperacion(item, true);
      }
      // Si es falso, la señal reactiva mantendrá automáticamente el checkbox en su estado original sin mutaciones raras.
    });
  }

  /**
   * Centraliza la mutación de la señal de operaciones pendientes (Purity/Immutability)
   */
  private procesarCambioOperacion(item: PermisoItem, checked: boolean) {
    const existente = this.permisos().find(
      p => p.modulo === item.modulo && p.accion === item.accion,
    );

    // Filtramos operaciones previas de este mismo item
    const ops = this.pendingOps().filter(
      op => !(op.item.modulo === item.modulo && op.item.accion === item.accion),
    );

    if (checked && !existente) {
      ops.push({ type: 'grant', item });
    } else if (!checked && existente) {
      ops.push({ type: 'revoke', item, permisoId: existente.id });
    }

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
          .pipe(map(() => true), catchError(() => of(false))),
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