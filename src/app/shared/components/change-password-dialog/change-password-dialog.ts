import { Component, inject, signal, OnInit } from '@angular/core';
import {
  FormBuilder, ReactiveFormsModule, Validators,
  AbstractControl, ValidationErrors,
} from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/auth/auth';

// Validador: confirmar que las contraseñas coincidan
function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const newPwd = parent.get('new_password')?.value;
  return newPwd && control.value !== newPwd ? { mismatch: true } : null;
}

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

  saving = signal(false);
  error = signal('');
  showNew = signal(false);
  showConf = signal(false);

  // El DNI es la contraseña inicial — no se muestra pero se usa internamente
  private readonly currentPassword = this.auth.currentUser()?.numero_documento ?? '';

  form = this.fb.group({
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, passwordsMatch]],
  });

  ngOnInit() {
    console.log('numero_documento en store:', this.auth.currentUser()?.numero_documento);
    console.log('currentPassword que se enviará:', this.currentPassword);
    this.form.get('new_password')?.valueChanges.subscribe(() => {
      this.form.get('confirm_password')?.updateValueAndValidity();
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const newPwd = this.form.value.new_password!;

    if (newPwd === this.currentPassword) {
      this.error.set('La nueva contraseña no puede ser igual a tu número de documento.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    // Usar el AuthService que ya tiene el manejo correcto
    this.auth.changePassword({
      current_password: this.currentPassword,
      new_password: newPwd,
    }).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (msg: string) => {
        // AuthService ya parsea el error y devuelve string
        this.error.set(msg);
        this.saving.set(false);
      },
    });
  }
}