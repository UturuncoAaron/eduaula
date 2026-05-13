// 📁 PATH: src/app/shared/components/user-dialog/user-dialog.ts
// (Reemplaza el actual)

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from 'ngx-toastr-notifier';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import { Rol, User } from '../../../core/models/user'; // 🔁 Antes: UserRole desde navigation.config

export interface UserDialogData {
  mode: 'create' | 'edit';
  rol: Rol; // 🔁 Antes: UserRole
  user?: User;
  isSelf?: boolean;
}

interface RoleMeta {
  label: string;
  icon: string;
  endpoint: string;
  color: string;
}

const ROLE_META: Record<Rol, RoleMeta> = {
  admin: { label: 'Administrador', icon: 'admin_panel_settings', endpoint: 'admin/users/admins', color: '#ef4444' },
  alumno: { label: 'Alumno', icon: 'school', endpoint: 'admin/users/alumnos', color: '#10b981' },
  docente: { label: 'Docente', icon: 'badge', endpoint: 'admin/users/docentes', color: '#f59e0b' },
  padre: { label: 'Padre / Tutor', icon: 'family_restroom', endpoint: 'admin/users/padres', color: '#8b5cf6' },
  psicologa: { label: 'Psicóloga', icon: 'psychology', endpoint: 'admin/users/psicologos', color: '#0ea5e9' },
  auxiliar: { label: 'Auxiliar', icon: 'support_agent', endpoint: 'admin/users/auxiliares', color: '#14b8a6' }, // 🆕
};

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
  ],
  templateUrl: './user-dialog.html',
  styleUrl: './user-dialog.scss',
})
export class UserDialog implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<UserDialog>);

  data = inject<UserDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = this.data.mode === 'edit';
  readonly isCreate = this.data.mode === 'create';
  readonly isSelf = this.data.isSelf ?? false;

  busy = signal(false);
  success = signal(false);
  error = signal('');

  fotoFile = signal<File | null>(null);
  fotoPreview = signal<string | null>(null);

  showCurrent = signal(false);
  showNew = signal(false);

  roleMeta = computed<RoleMeta>(() => ROLE_META[this.data.rol]);
  readonly fechaRequerida = this.data.rol === 'alumno';
  esContratado = computed(() => this.form.get('tipo_contrato')?.value === 'contratado');

  initials = computed(() => {
    const u = this.data.user;
    if (!u) return 'N';
    return ((u.nombre?.charAt(0) ?? '') + (u.apellido_paterno?.charAt(0) ?? '')).toUpperCase() || 'U';
  });

  progressWidth = computed(() => {
    const c = this.form.controls;
    const req = [c['tipo_documento'], c['numero_documento'], c['nombre'], c['apellido_paterno']];
    const opt = [c['apellido_materno'], c['email'], c['telefono']];
    const filledReq = req.filter(x => x.value?.toString().trim()).length;
    const filledOpt = opt.filter(x => x.value?.toString().trim()).length;
    return `${Math.round((filledReq / req.length) * 70 + (filledOpt / opt.length) * 30)}%`;
  });

  form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required]], // Validadores dinámicos asignados en ngOnInit
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100)]],
    apellido_materno: ['', Validators.maxLength(100)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    // Teléfono celular peruano: empieza con 9 + 8 dígitos (9XXXXXXXX).
    telefono: ['', Validators.pattern(/^9\d{8}$/)],
    fecha_nacimiento: [null as Date | null, this.fechaRequerida ? Validators.required : null],

    // Roles específicos
    especialidad: ['', Validators.maxLength(100)],
    titulo_profesional: ['', Validators.maxLength(100)],
    tipo_contrato: ['contratado'],
    estado_contrato: ['activo'],
    fecha_inicio_contrato: [null as Date | null],
    fecha_fin_contrato: [null as Date | null],
    relacion: ['', this.data.rol === 'padre' ? Validators.required : null],
    cargo: ['', Validators.maxLength(100)],
    colegiatura: ['', Validators.maxLength(50)],

    // Específico de alumno: marca al estudiante como caso de inclusión
    // educativa (NEE, adaptación curricular, etc.). Por defecto false.
    inclusivo: [false],

    // Contraseñas (solo edición)
    current_password: [''],
    new_password: ['', Validators.minLength(8)],
  });

  private docSub?: Subscription;

  ngOnInit() {
    this.setupDynamicValidators();

    if (this.isEdit && this.data.user) {
      const u = this.data.user;
      this.form.patchValue({
        tipo_documento: u.tipo_documento ?? 'dni',
        numero_documento: u.numero_documento ?? '',
        nombre: u.nombre ?? '',
        apellido_paterno: u.apellido_paterno ?? '',
        apellido_materno: u.apellido_materno ?? '',
        email: u.email ?? '',
        telefono: u.telefono ?? '',
        especialidad: u.especialidad ?? '',
        titulo_profesional: (u as any).titulo_profesional ?? '',
        colegiatura: u.colegiatura ?? '',
        cargo: u.cargo ?? '',
        relacion: u.relacion_familiar ?? '',
        inclusivo: (u as { inclusivo?: boolean }).inclusivo ?? false,
      });
    }
  }

  ngOnDestroy() {
    this.docSub?.unsubscribe();
  }

  // ─── Validadores Dinámicos ───────────────────────────────────
  private setupDynamicValidators() {
    const docCtrl = this.form.get('numero_documento');
    this.docSub = this.form.get('tipo_documento')?.valueChanges.subscribe(tipo => {
      docCtrl?.clearValidators();
      if (tipo === 'dni') {
        docCtrl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{8}$/)]);
      } else if (tipo === 'ce') {
        docCtrl?.setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9]{9,12}$/)]);
      } else {
        docCtrl?.setValidators([Validators.required, Validators.maxLength(20)]);
      }
      docCtrl?.updateValueAndValidity();
    });
    // Trigger inicial
    this.form.get('tipo_documento')?.updateValueAndValidity();
  }

  // ─── Photo ───────────────────────────────────────────────────
  onFotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.toastr.error('La imagen supera los 2 MB.', 'Archivo demasiado grande');
      return;
    }
    this.fotoFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.fotoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeFoto() { this.fotoFile.set(null); this.fotoPreview.set(null); }

  // ─── Helpers ─────────────────────────────────────────────────
  private toISODate(d: Date | null | undefined): string | null {
    return d ? d.toISOString().split('T')[0] : null;
  }

  private extractError(e: any): string {
    const b = e?.error;
    if (typeof b?.message === 'string') return b.message;
    if (Array.isArray(b?.message)) return b.message.join(', ');
    return 'Error al conectar con el servidor';
  }

  // ─── CREATE ──────────────────────────────────────────────────
  private submitCreate() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.busy.set(true);
    const v = this.form.value;

    const base: Record<string, unknown> = {
      tipo_documento: v.tipo_documento,
      numero_documento: v.numero_documento,
      nombre: v.nombre,
      apellido_paterno: v.apellido_paterno,
      ...(v.apellido_materno?.trim() && { apellido_materno: v.apellido_materno }),
      ...(v.email?.trim() && { email: v.email }),
      ...(v.telefono?.trim() && { telefono: v.telefono }),
      ...(v.fecha_nacimiento && { fecha_nacimiento: this.toISODate(v.fecha_nacimiento as Date) }),
    };

    const extras: Record<Rol, Record<string, unknown>> = {
      alumno: {
        inclusivo: !!v.inclusivo,
      },
      docente: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.titulo_profesional?.trim() && { titulo_profesional: v.titulo_profesional }),
        tipo_contrato: v.tipo_contrato,
        estado_contrato: v.estado_contrato,
        ...(v.fecha_inicio_contrato && { fecha_inicio_contrato: this.toISODate(v.fecha_inicio_contrato as Date) }),
        ...(v.fecha_fin_contrato && { fecha_fin_contrato: this.toISODate(v.fecha_fin_contrato as Date) }),
      },
      padre: { relacion: v.relacion },
      admin: { ...(v.cargo?.trim() && { cargo: v.cargo }) },
      psicologa: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad }),
        ...(v.colegiatura?.trim() && { colegiatura: v.colegiatura }),
      },
      auxiliar: {
        ...(v.cargo?.trim() && { cargo: v.cargo }),
        tipo_contrato: v.tipo_contrato,
        estado_contrato: v.estado_contrato,
        ...(v.fecha_inicio_contrato && { fecha_inicio_contrato: this.toISODate(v.fecha_inicio_contrato as Date) }),
        ...(v.fecha_fin_contrato && { fecha_fin_contrato: this.toISODate(v.fecha_fin_contrato as Date) }),
      },
    };

    this.api.post(ROLE_META[this.data.rol].endpoint, { ...base, ...extras[this.data.rol] }).subscribe({
      next: () => {
        this.toastr.success('Usuario registrado correctamente', '¡Éxito!');
        this.dialogRef.close(true);
        this.busy.set(false);
      },
      error: err => {
        this.toastr.error(this.extractError(err), 'Error');
        this.busy.set(false);
      },
    });
  }

  // ─── EDIT ────────────────────────────────────────────────────
  private async submitEdit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;

    if (this.isSelf && v.new_password && !v.current_password) {
      const msg = 'Ingresa tu contraseña actual para autorizar el cambio.';
      this.error.set(msg); this.toastr.error(msg, 'Requerido'); return;
    }

    this.busy.set(true);
    this.error.set('');
    this.success.set(false);

    try {
      // 1. Foto (Solo si isSelf es true)
      if (this.isSelf && this.fotoFile()) {
        const fd = new FormData();
        fd.append('foto', this.fotoFile()!);
        const res: any = await this.api.post('users/foto', fd).toPromise();
        const url = res?.foto_url ?? res?.data?.foto_url;
        if (url) {
          this.fotoPreview.set(url);
          this.auth.updateCurrentUser({ foto_url: url });
        }
      }

      // 2. PUT perfil
      const endpoint = this.isSelf ? 'users/me' : `admin/users/${this.data.user!.id}`;

      const payload: Record<string, any> = {
        nombre: v.nombre,
        apellido_paterno: v.apellido_paterno,
        apellido_materno: v.apellido_materno || null,
        telefono: v.telefono || null,
        email: v.email || null,
      };

      if (v.especialidad) payload['especialidad'] = v.especialidad;
      if (v.titulo_profesional) payload['titulo_profesional'] = v.titulo_profesional;
      if (v.colegiatura) payload['colegiatura'] = v.colegiatura;
      if (v.cargo) payload['cargo'] = v.cargo;
      if (v.relacion) payload['relacion'] = v.relacion;
      if (this.data.rol === 'alumno') payload['inclusivo'] = !!v.inclusivo;

      if (!this.isSelf) {
        payload['tipo_documento'] = v.tipo_documento;
        payload['numero_documento'] = v.numero_documento;
      }

      if (v.new_password) {
        payload['new_password'] = v.new_password;
        if (this.isSelf) payload['current_password'] = v.current_password;
      }

      await this.api.put(endpoint, payload).toPromise();

      if (this.isSelf) {
        this.auth.updateCurrentUser({
          nombre: v.nombre!,
          apellido_paterno: v.apellido_paterno!,
          apellido_materno: v.apellido_materno || null,
          telefono: v.telefono || null,
          email: v.email || null,
        });
      }

      this.busy.set(false);
      this.success.set(true);
      this.toastr.success('Perfil actualizado correctamente.', '¡Éxito!');
      setTimeout(() => this.dialogRef.close({ updated: true }), 1200);

    } catch (e: any) {
      const msg = this.extractError(e);
      this.busy.set(false);
      this.error.set(msg);
      this.toastr.error(msg, 'Error');
    }
  }

  submit() {
    if (this.isCreate) this.submitCreate();
    else this.submitEdit();
  }
}