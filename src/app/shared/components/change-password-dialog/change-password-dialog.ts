import {
  Component, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule,
  Validators, AbstractControl, ValidationErrors,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { AuthService } from '../../../core/auth/auth';

export interface ChangePasswordDialogData {
  rol: string;
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './change-password-dialog.html',
  styleUrl: './change-password-dialog.scss',
})
export class ChangePasswordDialog {
  readonly data: ChangePasswordDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ChangePasswordDialog>);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);

  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  loading = signal(false);
  errorMsg = signal('');

  form: FormGroup = this.fb.group(
    {
      current_password: ['', [Validators.required, Validators.minLength(4)]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required, Validators.minLength(6)]],
    },
    { validators: [matchValidator, notSameValidator] },
  );

  toggleCurrent() { this.showCurrent.update(v => !v); }
  toggleNew() { this.showNew.update(v => !v); }
  toggleConfirm() { this.showConfirm.update(v => !v); }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    const { current_password, new_password } = this.form.value;

    this.auth.changePassword({
      current_password: current_password!,
      new_password: new_password!,
    }).subscribe({
      next: () => {
        this.toastr.success('Contraseña actualizada correctamente');
        this.loading.set(false);
        this.ref.close(true);
      },
      error: (msg: string) => {
        this.errorMsg.set(msg || 'No se pudo actualizar la contraseña');
        this.loading.set(false);
      },
    });
  }
}

function matchValidator(group: AbstractControl): ValidationErrors | null {
  const np = group.get('new_password')?.value;
  const cp = group.get('confirm_password')?.value;
  return np && cp && np !== cp ? { passwordsMismatch: true } : null;
}

function notSameValidator(group: AbstractControl): ValidationErrors | null {
  const cur = group.get('current_password')?.value;
  const np = group.get('new_password')?.value;
  return cur && np && cur === np ? { sameAsCurrent: true } : null;
}
