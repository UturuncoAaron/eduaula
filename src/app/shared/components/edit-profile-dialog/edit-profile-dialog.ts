import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';
import { User } from '../../../core/models/user';

export interface EditProfileDialogData {
  user: User;
  isSelf: boolean; // true → PUT /users/me  |  false → PUT /admin/users/:id
}

@Component({
  selector: 'app-edit-profile-dialog',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './edit-profile-dialog.html',
  styleUrl: './edit-profile-dialog.scss',
})
export class EditProfileDialog implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private dialogRef = inject(MatDialogRef<EditProfileDialog>);

  data = inject<EditProfileDialogData>(MAT_DIALOG_DATA);

  saving = signal(false);
  success = signal(false);
  error = signal('');

  fotoFile = signal<File | null>(null);
  fotoPreview = signal<string | null>(null);

  showNew = signal(false);
  showConfirm = signal(false);
  showCurrent = signal(false);

  // ── Formulario completo ───────────────────────────────────────────────
  form = {
    // Documento (solo visible/editable si !isSelf)
    tipo_documento: '',
    numero_documento: '',
    // Personales
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    telefono: '',
    // Contacto
    email: '',
    // Por rol
    especialidad: '',
    titulo_profesional: '',
    colegiatura: '',
    cargo: '',
    relacion: '',
    // Contraseña (opcional)
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  private roleColors: Record<string, string> = {
    alumno: '#10b981',
    docente: '#f59e0b',
    admin: '#ef4444',
    padre: '#8b5cf6',
    psicologa: '#0ea5e9',
  };

  roleColor = () => this.roleColors[this.data.user.rol] ?? '#64748b';

  initials = () => {
    const u = this.data.user;
    return ((u.nombre?.charAt(0) ?? '') + (u.apellido_paterno?.charAt(0) ?? '')).toUpperCase() || 'U';
  };

  private extractError(e: any): string {
    const b = e?.error;
    if (typeof b?.message === 'string') return b.message;
    if (Array.isArray(b?.message)) return b.message.join(', ');
    return 'Error al conectar con el servidor';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit() {
    const u = this.data.user;
    this.form.tipo_documento = u.tipo_documento ?? 'dni';
    this.form.numero_documento = u.numero_documento ?? '';
    this.form.nombre = u.nombre ?? '';
    this.form.apellido_paterno = u.apellido_paterno ?? '';
    this.form.apellido_materno = u.apellido_materno ?? '';
    this.form.telefono = u.telefono ?? '';
    this.form.email = u.email ?? '';
    this.form.especialidad = u.especialidad ?? '';
    this.form.titulo_profesional = (u as any).titulo_profesional ?? '';
    this.form.colegiatura = u.colegiatura ?? '';
    this.form.cargo = u.cargo ?? '';
    this.form.relacion = u.relacion_familiar ?? '';
  }

  // ── Foto ──────────────────────────────────────────────────────────────
  onFotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('La imagen supera los 2 MB.');
      return;
    }
    this.fotoFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => this.fotoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeFoto() {
    this.fotoFile.set(null);
    this.fotoPreview.set(null);
  }

  // ── Guardar ───────────────────────────────────────────────────────────
  async save() {
    // Validaciones básicas
    if (!this.form.nombre.trim() || !this.form.apellido_paterno.trim()) {
      this.error.set('Nombre y apellido paterno son obligatorios.');
      return;
    }
    if (this.form.new_password && this.form.new_password !== this.form.confirm_password) return;
    if (this.form.new_password && this.form.new_password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.data.isSelf && this.form.new_password && !this.form.current_password) {
      this.error.set('Debes ingresar tu contraseña actual para cambiarla.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set(false);

    try {
      // ── 1. Foto (multipart — sigue siendo una llamada separada) ────────
      if (this.fotoFile()) {
        const fd = new FormData();
        fd.append('foto', this.fotoFile()!);
        const res: any = await this.api.post('users/foto', fd).toPromise();
        const url = res?.foto_url ?? res?.data?.foto_url;
        if (url) {
          this.fotoPreview.set(url);
          if (this.data.isSelf) this.auth.updateCurrentUser({ foto_url: url });
        }
      }

      // ── 2. PUT unificado — una sola llamada para todo lo demás ─────────
      const endpoint = this.data.isSelf
        ? 'users/me'
        : `admin/users/${this.data.user.id}`;

      const payload: Record<string, any> = {
        nombre: this.form.nombre,
        apellido_paterno: this.form.apellido_paterno,
        apellido_materno: this.form.apellido_materno || null,
        telefono: this.form.telefono || null,
        email: this.form.email || null,
      };

      // Campos por rol (solo si tienen valor)
      if (this.form.especialidad) payload['especialidad'] = this.form.especialidad;
      if (this.form.titulo_profesional) payload['titulo_profesional'] = this.form.titulo_profesional;
      if (this.form.colegiatura) payload['colegiatura'] = this.form.colegiatura;
      if (this.form.cargo) payload['cargo'] = this.form.cargo;
      if (this.form.relacion) payload['relacion'] = this.form.relacion;

      // Documento (solo admin editando otro usuario)
      if (!this.data.isSelf) {
        payload['tipo_documento'] = this.form.tipo_documento;
        payload['numero_documento'] = this.form.numero_documento;
      }

      // Contraseña (opcional)
      if (this.form.new_password) {
        payload['new_password'] = this.form.new_password;
        if (this.data.isSelf) {
          payload['current_password'] = this.form.current_password;
        }
      }

      await this.api.put(endpoint, payload).toPromise();

      // ── 3. Actualizar signal del usuario logueado si es self ───────────
      if (this.data.isSelf) {
        this.auth.updateCurrentUser({
          nombre: this.form.nombre,
          apellido_paterno: this.form.apellido_paterno,
          apellido_materno: this.form.apellido_materno || null,
          telefono: this.form.telefono || null,
          email: this.form.email || null,
        });
      }

      this.saving.set(false);
      this.success.set(true);
      setTimeout(() => this.dialogRef.close({ updated: true }), 1200);

    } catch (e: any) {
      this.saving.set(false);
      this.error.set(this.extractError(e));
    }
  }
}