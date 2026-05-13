import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { UserAvatar, AvatarRole } from '../../../shared/components/user-avatar/user-avatar';
//                       ^^^^^^^^^^ importar el tipo

// ── Tipos ──────────────────────────────────────────────────────
export type UserTipo = 'alumnos' | 'docentes' | 'padres' | 'admins' | 'psicologos';

export interface UserDetailDialogData {
  id: string;
  tipo: UserTipo;
}

/** Padre vinculado al alumno (solo se carga si tipo === 'alumnos'). */
interface PadreVinculado {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  telefono: string | null;
  numero_documento: string | null;
}

interface UserDetail {
  id?: string;
  nombre?: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  email?: string;
  telefono?: string;
  foto_url?: string | null;
  tipo_documento?: string;
  numero_documento?: string;
  codigo_acceso?: string;
  codigo_estudiante?: string;
  activo?: boolean;
  fecha_nacimiento?: string;
  grado?: string;
  seccion?: string;
  relacion?: string;
  cargo?: string;
  especialidad?: string;
  titulo_profesional?: string;
  colegiatura?: string;
  tipo_contrato?: string;
  estado_contrato?: string;
  fecha_inicio_contrato?: string;
  fecha_fin_contrato?: string;
}

interface TipoMeta {
  label: string;
  color: string;
  rol: AvatarRole;            // ← antes era `any`
}

// ── Constantes ─────────────────────────────────────────────────
const TIPO_META: Record<UserTipo, TipoMeta> = {
  alumnos: { label: 'Alumno', color: '#10b981', rol: 'alumno' },
  docentes: { label: 'Docente', color: '#f59e0b', rol: 'docente' },
  padres: { label: 'Padre / Tutor', color: '#8b5cf6', rol: 'padre' },
  admins: { label: 'Administrador', color: '#ef4444', rol: 'admin' },
  psicologos: { label: 'Psicóloga', color: '#0ea5e9', rol: 'psicologa' },
};

const RELACION_LABEL: Record<string, string> = {
  padre: 'Padre', madre: 'Madre', tutor: 'Tutor Legal', apoderado: 'Apoderado',
};

const CONTRATO_LABEL: Record<string, string> = {
  nombrado: 'Nombrado', contratado: 'Contratado',
};

const ESTADO_CONTRATO_LABEL: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', pendiente: 'Pendiente',
};

@Component({
  selector: 'app-user-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, UpperCasePipe,
    MatIconModule, MatButtonModule,
    MatDividerModule, MatDialogModule,
    UserAvatar,
  ],
  templateUrl: './user-detail-dialog.html',
  styleUrl: './user-detail-dialog.scss',
})
export class UserDetailDialog implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<UserDetailDialog>);

  data = inject<UserDetailDialogData>(MAT_DIALOG_DATA);
  loading = signal(true);
  user = signal<UserDetail | null>(null);
  /** Padres vinculados al alumno (solo aplica cuando tipo === 'alumnos'). */
  padresVinculados = signal<PadreVinculado[]>([]);

  meta = computed<TipoMeta>(
    () => TIPO_META[this.data.tipo] ?? TIPO_META.alumnos,
  );

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.api.get<any>(`admin/users/${this.data.tipo}/${this.data.id}`).subscribe({
      //         ^^^^ mantener `any` como tu original (evita conflicto con ApiService)
      next: (r) => {
        this.user.set(r.data as UserDetail);
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar el usuario', 'Error');
        this.dialogRef.close();
      },
    });

    // Si estamos viendo un alumno, en paralelo traemos sus padres vinculados
    // para mostrarlos en el perfil. No bloquea el render del resto del dialog.
    if (this.data.tipo === 'alumnos') {
      this.api
        .get<any>(`admin/users/alumnos/${this.data.id}/padres`)
        .subscribe({
          next: (r) => {
            const list = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
            this.padresVinculados.set(list as PadreVinculado[]);
          },
          // Silencioso: la falta de padres es un estado válido (no error).
          error: () => this.padresVinculados.set([]),
        });
    }
  }

  // ── Derivados ────────────────────────────────────────────────
  nombreCompleto = computed(() => {
    const u = this.user();
    if (!u) return '';
    const nombre = u.nombre ?? u.nombres ?? '';
    return [u.apellido_paterno, u.apellido_materno, nombre]
      .filter(Boolean).join(' ');
  });

  iniciales = computed(() => {
    const u = this.user();
    if (!u) return '';
    const n = (u.nombre ?? u.nombres ?? '').charAt(0);
    const a = (u.apellido_paterno ?? '').charAt(0);
    return (n + a).toUpperCase();
  });

  edad = computed<number | null>(() => {
    const u = this.user();
    if (!u?.fecha_nacimiento) return null;
    const hoy = new Date();
    const nac = new Date(u.fecha_nacimiento);
    let e = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
    return e;
  });

  hasIdentidad = computed(() => {
    const u = this.user();
    return !!(u?.numero_documento || u?.codigo_acceso || u?.codigo_estudiante);
  });

  hasDatosPersonales = computed(() => {
    const u = this.user();
    return !!(u?.fecha_nacimiento || u?.grado || u?.relacion || u?.cargo);
  });

  hasProfesional = computed(() => {
    const u = this.user();
    return !!(u?.especialidad || u?.titulo_profesional || u?.colegiatura);
  });

  // ── Labels ───────────────────────────────────────────────────
  relacionLabel = (r?: string) => (r && RELACION_LABEL[r]) ?? r ?? '';
  contratoLabel = (c?: string) => (c && CONTRATO_LABEL[c]) ?? c ?? '';
  estadoConLabel = (e?: string) => (e && ESTADO_CONTRATO_LABEL[e]) ?? e ?? '';
}