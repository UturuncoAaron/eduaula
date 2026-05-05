import { Component, inject, signal, computed, OnInit } from '@angular/core';
import {
  FormBuilder, ReactiveFormsModule, Validators,
  AbstractControl, ValidationErrors,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';

// ── Validador: confirmar coincidencia ──────────────────────────
function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const newPwd = parent.get('new_password')?.value;
  return newPwd && control.value !== newPwd ? { mismatch: true } : null;
}

// ── Tipos auxiliares ───────────────────────────────────────────
interface PasswordRule {
  label: string;
  test: (pwd: string) => boolean;
}

interface StrengthLevel {
  score: number;   // 0..4
  label: string;
  color: string;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Mínimo 8 caracteres', test: p => p.length >= 8 },
  { label: 'Una letra mayúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Un número', test: p => /\d/.test(p) },
  { label: 'Un símbolo', test: p => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_TABLE: Record<number, StrengthLevel> = {
  0: { score: 0, label: 'Muy débil', color: '#ef4444' },
  1: { score: 1, label: 'Débil', color: '#f59e0b' },
  2: { score: 2, label: 'Aceptable', color: '#eab308' },
  3: { score: 3, label: 'Segura', color: '#10b981' },
  4: { score: 4, label: 'Muy segura', color: '#059669' },
};

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule,
  ],
  templateUrl: './change-password-dialog.html',
  styleUrl: './change-password-dialog.scss',
})
export class ChangePasswordDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private dialogRef = inject(MatDialogRef<ChangePasswordDialog>);

  // ── UI state ─────────────────────────────────────────────────
  saving = signal(false);
  error = signal('');
  showNew = signal(false);
  showConf = signal(false);

  // ── Datos de origen ──────────────────────────────────────────
  private readonly currentPassword =
    this.auth.currentUser()?.numero_documento ?? '';

  // ── Form ─────────────────────────────────────────────────────
  form = this.fb.group({
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, passwordsMatch]],
  });

  // Valor reactivo del nuevo password como signal
  private newPasswordValue = toSignal(
    this.form.controls.new_password.valueChanges,
    { initialValue: '' },
  );

  // ── Reglas evaluadas ─────────────────────────────────────────
  rules = computed(() => {
    const pwd = this.newPasswordValue() ?? '';
    return PASSWORD_RULES.map(r => ({ label: r.label, valid: r.test(pwd) }));
  });

  // ── Fortaleza derivada ───────────────────────────────────────
  strength = computed<StrengthLevel | null>(() => {
    const pwd = this.newPasswordValue() ?? '';
    if (!pwd) return null;
    const score = this.rules().filter(r => r.valid).length;
    return STRENGTH_TABLE[score] ?? STRENGTH_TABLE[0];
  });

  hasPassword = computed(() => !!this.newPasswordValue());

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.form.controls.new_password.valueChanges.subscribe(() => {
      this.form.controls.confirm_password.updateValueAndValidity();
    });
  }

  // ── Acciones ─────────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const newPwd = this.form.value.new_password!;

    if (newPwd === this.currentPassword) {
      this.error.set(
        'La nueva contraseña no puede ser igual a tu número de documento.',
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.auth.changePassword({
      current_password: this.currentPassword,
      new_password: newPwd,
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (msg: string) => {
        this.error.set(msg);
        this.saving.set(false);
      },
    });
  }
}