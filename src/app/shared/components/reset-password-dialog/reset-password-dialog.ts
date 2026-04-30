import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';
import { ToastService } from 'ngx-toastr-notifier';

export interface ResetPasswordDialogData {
  id: string;
  nombre: string;
}

@Component({
  selector: 'app-reset-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './reset-password-dialog.html',
  styleUrl: './reset-password-dialog.scss',
})
export class ResetPasswordDialog {
  readonly data: ResetPasswordDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ResetPasswordDialog>);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private toastr = inject(ToastService);
  

  show = signal(false);
  loading = signal(false);

  passwordCtrl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
  ]);

  toggleShow() {
    this.show.update(v => !v);
  }

  confirm() {
    if (this.passwordCtrl.invalid) {
      this.passwordCtrl.markAsTouched();
      return;
    }

    this.loading.set(true);

    this.api.patch(`admin/users/${this.data.id}/reset-password`, {
      password: this.passwordCtrl.value,
    }).subscribe({
      next: () => {
        this.toastr.success('Contraseña actualizada correctamente', 'Cerrar');
        this.ref.close(true);
      },
      error: (err) => {
        this.toastr.error('Error al actualizar la contraseña');
        this.loading.set(false);
      },
    });
  }

  cancel() {
    this.ref.close(false);
  }
}