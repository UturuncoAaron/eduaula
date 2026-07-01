import {
  Component, inject, signal, computed,
  OnInit, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef,
  HostListener
} from '@angular/core';
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
import { Rol, User } from '../../../core/models/user';

export interface UserDialogData {
  mode: 'create' | 'edit';
  rol: Rol;
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
  admin: { label: 'Administrador', icon: 'shield_person', endpoint: 'admin/users/admins', color: '#6366f1' },
  alumno: { label: 'Estudiante', icon: 'school', endpoint: 'admin/users/alumnos', color: '#0ea5e9' },
  docente: { label: 'Docente', icon: 'co_present', endpoint: 'admin/users/docentes', color: '#10b981' },
  padre: { label: 'Familiar / Apoderado', icon: 'supervised_user_circle', endpoint: 'admin/users/padres', color: '#8b5cf6' },
  psicologa: { label: 'Psicología', icon: 'psychology', endpoint: 'admin/users/psicologos', color: '#ec4899' },
  staff: { label: 'Personal Administrativo', icon: 'badge', endpoint: 'admin/users/staff', color: '#f59e0b' },
};

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatCheckboxModule, MatDialogModule
  ],
  templateUrl: './user-dialog.html',
  styleUrl: './user-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDialog implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(MatDialogRef<UserDialog>);

  readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = this.data.mode === 'edit';
  readonly isCreate = this.data.mode === 'create';
  readonly isSelf = this.data.isSelf ?? false;

  readonly busy = signal(false);
  readonly success = signal(false);
  readonly error = signal('');
  readonly fotoFile = signal<File | null>(null);
  readonly fotoPreview = signal<string | null>(null);
  readonly fotoMenuOpen = signal(false);
  readonly deletingFoto = signal(false);
  readonly showCurrent = signal(false);
  readonly showNew = signal(false);

  readonly roleMeta = computed<RoleMeta>(() => ROLE_META[this.data.rol]);
  readonly esContratado = computed(() => this.form.get('tipo_contrato')?.value === 'contratado');

  readonly initials = computed(() => {
    const u = this.data.user;
    if (!u) return 'U';
    return `${u.nombre?.charAt(0) ?? ''}${u.apellido_paterno?.charAt(0) ?? ''}`.toUpperCase() || 'U';
  });

  readonly progressWidth = computed(() => {
    const c = this.form.controls;
    const fieldsToTrack = [c.tipo_documento, c.numero_documento, c.nombre, c.apellido_paterno];
    const filled = fieldsToTrack.filter(ctrl => ctrl.value?.toString().trim()).length;
    return `${Math.round((filled / fieldsToTrack.length) * 100)}%`;
  });

  readonly form = this.fb.group({
    tipo_documento: ['dni', Validators.required],
    numero_documento: ['', [Validators.required]],
    nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/)]],
    apellido_paterno: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/)]],
    apellido_materno: ['', [Validators.maxLength(100), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    telefono: ['', [Validators.pattern(/^9\d{8}$/)]],
    fecha_nacimiento: [null as Date | null],
    especialidad: ['', Validators.maxLength(100)],
    titulo_profesional: ['', Validators.maxLength(100)],
    tipo_contrato: ['contratado'],
    estado_contrato: ['activo'],
    fecha_inicio_contrato: [null as Date | null],
    fecha_fin_contrato: [null as Date | null],
    relacion: ['', this.data.rol === 'padre' ? Validators.required : null],
    cargo: ['', Validators.maxLength(100)],
    colegiatura: ['', Validators.maxLength(50)],
    es_inclusivo: [false],
    current_password: [''],
    new_password: ['', [Validators.minLength(8)]],
  });

  private docSub?: Subscription;
  private passSub?: Subscription;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.fotoMenuOpen()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.avatar-wrapper')) {
      this.fotoMenuOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    this.setupDynamicValidators();
    this.initializeFormValues();
  }

  ngOnDestroy(): void {
    this.docSub?.unsubscribe();
    this.passSub?.unsubscribe();
  }

  private initializeFormValues(): void {
    if (this.isEdit && this.data.user) {
      this.patchForm(this.data.user);
      this.busy.set(true);
      const endpoint = `${ROLE_META[this.data.rol].endpoint}/${this.data.user.id}`;
      this.api.get<any>(endpoint).subscribe({
        next: (res) => {
          const userData = res?.data || res;
          if (userData) this.patchForm(userData);
          this.busy.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.busy.set(false);
          this.cdr.markForCheck();
        }
      });
    }
  }

  private patchForm(u: any): void {
    const rawFechaNacimiento = u.fecha_nacimiento ?? u.fechaNacimiento ?? (u as any).birthdate ?? null;

    this.form.patchValue({
      tipo_documento: u.tipo_documento ?? 'dni',
      numero_documento: u.numero_documento ?? '',
      nombre: u.nombre ?? '',
      apellido_paterno: u.apellido_paterno ?? '',
      apellido_materno: u.apellido_materno ?? '',
      email: u.email ?? '',
      telefono: u.telefono ?? '',
      especialidad: u.especialidad ?? '',
      titulo_profesional: u.titulo_profesional ?? '',
      colegiatura: u.colegiatura ?? '',
      relacion: u.relacion_familiar ?? '',
      es_inclusivo: u.inclusivo ?? false,
      fecha_nacimiento: this.parseBackendDate(rawFechaNacimiento),
    });

    if (this.data.rol === 'staff' || this.data.rol === 'admin') {
      this.form.get('cargo')?.setValue(u.cargo || u.puesto || '');
    }

    this.form.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  private parseBackendDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;

    const dateStr = dateValue.toString().trim();

    if (dateStr.includes('T')) {
      const baseDate = new Date(dateStr);
      if (!isNaN(baseDate.getTime())) {
        return new Date(baseDate.getTime() + baseDate.getTimezoneOffset() * 60000);
      }
    }

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) return new Date(year, month, day);
    }

    return null;
  }

  private setupDynamicValidators(): void {
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

    if (this.isSelf) {
      const currentPassCtrl = this.form.get('current_password');
      this.passSub = this.form.get('new_password')?.valueChanges.subscribe(newPass => {
        if (newPass && newPass.trim().length > 0) {
          currentPassCtrl?.setValidators([Validators.required]);
        } else {
          currentPassCtrl?.clearValidators();
        }
        currentPassCtrl?.updateValueAndValidity();
      });
    }

    this.form.get('tipo_documento')?.updateValueAndValidity();
  }

  toggleFotoMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.fotoMenuOpen.set(!this.fotoMenuOpen());
  }

  onFotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.toastr.error('La imagen de perfil supera el límite de 2 MB permitido.', 'Archivo excedido');
      return;
    }
    this.fotoFile.set(file);
    this.fotoMenuOpen.set(false);
    const reader = new FileReader();
    reader.onload = e => this.fotoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async onQuitarFoto(): Promise<void> {
    this.fotoMenuOpen.set(false);

    if (this.fotoFile()) {
      this.fotoFile.set(null);
      this.fotoPreview.set(null);
      this.cdr.markForCheck();
      return;
    }

    if (!this.data.user?.foto_url) return;

    this.deletingFoto.set(true);
    try {
      await this.api.delete('users/foto').toPromise();
      this.fotoPreview.set(null);
      if (this.data.user) this.data.user.foto_url = null as any;
      this.auth.updateCurrentUser({ foto_url: null });
      this.toastr.success('Foto de perfil eliminada correctamente.', '¡Listo!');
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toastr.error(this.extractError(e), 'Error al eliminar foto');
    } finally {
      this.deletingFoto.set(false);
      this.cdr.markForCheck();
    }
  }

  private toISODate(d: Date | null | undefined): string | null {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractError(e: any): string {
    const b = e?.error;
    if (typeof b?.message === 'string') return b.message;
    if (Array.isArray(b?.message)) return b.message.join(', ');
    return 'Error interno en la comunicación con el servidor institucional';
  }

  private submitCreate(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.busy.set(true);
    const v = this.form.value;

    const base: Record<string, unknown> = {
      tipo_documento: v.tipo_documento,
      numero_documento: v.numero_documento,
      nombre: v.nombre?.trim(),
      apellido_paterno: v.apellido_paterno?.trim(),
      ...(v.apellido_materno?.trim() && { apellido_materno: v.apellido_materno.trim() }),
      ...(v.email?.trim() && { email: v.email.trim().toLowerCase() }),
      ...(v.telefono?.trim() && { telefono: v.telefono.trim() }),
      ...(v.fecha_nacimiento && { fecha_nacimiento: this.toISODate(v.fecha_nacimiento as Date) }),
    };

    const extras: Record<Rol, Record<string, unknown>> = {
      alumno: { inclusivo: !!v.es_inclusivo },
      docente: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad.trim() }),
        ...(v.titulo_profesional?.trim() && { titulo_profesional: v.titulo_profesional.trim() }),
        tipo_contrato: v.tipo_contrato,
        estado_contrato: v.estado_contrato,
        ...(v.fecha_inicio_contrato && { fecha_inicio_contrato: this.toISODate(v.fecha_inicio_contrato as Date) }),
        ...(v.fecha_fin_contrato && { fecha_fin_contrato: this.toISODate(v.fecha_fin_contrato as Date) }),
      },
      padre: { relacion: v.relacion },
      admin: { ...(v.cargo?.trim() && { cargo: v.cargo.trim() }) },
      psicologa: {
        ...(v.especialidad?.trim() && { especialidad: v.especialidad.trim() }),
        ...(v.colegiatura?.trim() && { colegiatura: v.colegiatura.trim() }),
      },
      staff: { ...(v.cargo?.trim() && { cargo: v.cargo.trim() }) },
    };

    this.api.post(ROLE_META[this.data.rol].endpoint, { ...base, ...extras[this.data.rol] }).subscribe({
      next: () => {
        this.toastr.success('Usuario registrado correctamente con las credenciales base', '¡Éxito!');
        this.dialogRef.close(true);
        this.busy.set(false);
      },
      error: err => {
        this.toastr.error(this.extractError(err), 'Error de Registro');
        this.busy.set(false);
      },
    });
  }

  private async submitEdit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;

    this.busy.set(true);
    this.error.set('');
    this.success.set(false);

    try {
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

      const endpoint = this.isSelf ? 'users/me' : `admin/users/${this.data.user!.id}`;

      const payload: Record<string, any> = {
        nombre: v.nombre?.trim(),
        apellido_paterno: v.apellido_paterno?.trim(),
        apellido_materno: v.apellido_materno?.trim() || null,
        telefono: v.telefono?.trim() || null,
        email: v.email?.trim() ? v.email.trim().toLowerCase() : null,
        fecha_nacimiento: v.fecha_nacimiento ? this.toISODate(v.fecha_nacimiento as Date) : null,
      };

      if (v.especialidad) payload['especialidad'] = v.especialidad.trim();
      if (v.titulo_profesional) payload['titulo_profesional'] = v.titulo_profesional.trim();
      if (v.colegiatura) payload['colegiatura'] = v.colegiatura.trim();
      if (v.cargo) payload['cargo'] = v.cargo.trim();
      if (v.relacion) payload['relacion'] = v.relacion;
      if (this.data.rol === 'alumno') payload['inclusivo'] = !!v.es_inclusivo;

      if (!this.isSelf) {
        payload['tipo_documento'] = v.tipo_documento;
        payload['numero_documento'] = v.numero_documento;
      }

      if (v.new_password?.trim()) {
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
      this.toastr.success('Cambios aplicados de forma segura sobre la cuenta.', '¡Éxito!');
      setTimeout(() => this.dialogRef.close({ updated: true }), 1000);

    } catch (e: any) {
      const msg = this.extractError(e);
      this.busy.set(false);
      this.error.set(msg);
      this.toastr.error(msg, 'Error de Guardado');
    }
  }

  submit(): void {
    if (this.isCreate) this.submitCreate();
    else this.submitEdit();
  }
}