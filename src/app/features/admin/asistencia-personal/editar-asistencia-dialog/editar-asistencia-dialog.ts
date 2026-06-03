import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import type { AsistenciaPersonalRow } from '../asistencia-personal';

@Component({
    selector: 'app-editar-asistencia-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatIconModule,
    ],
    template: `
    <div class="dialog-container-panel fade-in">
      <header class="dialog-header-corporate">
        <div class="header-main-split">
          <div class="avatar-icon-box">
            <mat-icon>edit_note</mat-icon>
          </div>
          <div class="user-meta-block">
            <span class="eyebrow-tag">Modificación Administrativa</span>
            <h2>{{ data.nombre_completo }}</h2>
          </div>
        </div>
        <button class="close-dismiss-btn" mat-dialog-close><mat-icon>close</mat-icon></button>
      </header>

      <mat-dialog-content class="dialog-scroll-body">
        <form [formGroup]="form" class="clean-modern-form">
          <div class="form-grid-layout">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Estado de la Jornada</mat-label>
              <mat-select formControlName="estado">
                <mat-option value="presente">Presente</mat-option>
                <mat-option value="tardanza">Tardanza</mat-option>
                <mat-option value="falto">Falta Injustificada</mat-option>
                <mat-option value="justificado">Justificado</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Hora de Entrada</mat-label>
              <mat-icon matPrefix>login</mat-icon>
              <input matInput formControlName="hora_entrada" placeholder="HH:mm:ss" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Hora de Salida</mat-label>
              <mat-icon matPrefix>logout</mat-icon>
              <input matInput formControlName="hora_salida" placeholder="HH:mm:ss" />
            </mat-form-field>
          </div>

          @if (esJustificado()) {
          <div class="conditional-textarea-wrapper fade-in">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Motivo Explicativo de la Justificación</mat-label>
              <textarea matInput formControlName="motivo_justificacion" rows="3" placeholder="Detalle los motivos institucionales oficiales..."></textarea>
              @if (form.controls['motivo_justificacion'].invalid && form.controls['motivo_justificacion'].touched) {
                <mat-error>La descripción del motivo es estrictamente obligatoria.</mat-error>
              }
            </mat-form-field>
          </div>
          }

          <div class="w-full-textarea-block">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Observación Interna (Opcional)</mat-label>
              <textarea matInput formControlName="observacion" rows="2" placeholder="Notas administrativas visibles solo para dirección..."></textarea>
            </mat-form-field>
          </div>

          @if (error()) {
          <div class="error-banner-alert">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error() }}</span>
          </div>
          }
        </form>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions-footer-bar">
        <button mat-button class="btn-cancel-flat" mat-dialog-close [disabled]="busy()">Cancelar</button>
        <button mat-flat-button class="btn-save-corporate" (click)="submit()" [disabled]="busy()">
          @if (busy()) { <span class="custom-spinner-ring"></span> }
          @if (!busy()) { <mat-icon>save</mat-icon> }
          <span>{{ busy() ? 'Guardando cambios...' : 'Confirmar Cambios' }}</span>
        </button>
      </mat-dialog-actions>
    </div>
    `,
    styles: [`
      :host { display: block; background: #ffffff; border-radius: 16px; overflow: hidden; }
      .dialog-container-panel { display: flex; flex-direction: column; width: 100%; box-sizing: border-box; }
      
      .dialog-header-corporate {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
        
        .header-main-split { display: flex; align-items: center; gap: 1rem; }
        .avatar-icon-box {
            width: 44px; height: 44px; border-radius: 10px; background: rgba(79, 70, 229, 0.1); color: #4f46e5;
            display: flex; align-items: center; justify-content: center; mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }
        .user-meta-block {
            display: flex; flex-direction: column; gap: 0.15rem;
            .eyebrow-tag { font-size: 0.725rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
            h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
        }
        .close-dismiss-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; &:hover { color: #475569; } }
      }

      .dialog-scroll-body { padding: 1.5rem !important; margin: 0; box-sizing: border-box; max-height: 65vh; overflow-y: auto; }
      .clean-modern-form { display: flex; flex-direction: column; gap: 1.25rem; }
      .form-grid-layout { display: grid; grid-template-columns: 1fr; gap: 1.25rem; @media (min-width: 600px) { grid-template-columns: repeat(3, 1fr); } }
      .w-full { width: 100%; }
      
      .error-banner-alert {
        display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 8px;
        background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; font-size: 0.85rem; font-weight: 500;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .dialog-actions-footer-bar {
        display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
        padding: 1.25rem 1.5rem !important; border-top: 1px solid #e2e8f0; background: #f8fafc;
        
        .btn-cancel-flat { height: 44px; padding: 0 1.25rem; font-weight: 600; color: #475569; }
        .btn-save-corporate {
            height: 44px; padding: 0 1.5rem; font-weight: 600; background: #0f172a !important; color: #ffffff !important;
            border-radius: 8px !important; display: inline-flex; align-items: center; gap: 0.5rem;
        }
      }

      .custom-spinner-ring {
        width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff;
        border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .fade-in { animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
    `]
})
export class EditarAsistenciaDialog {
    private fb = inject(FormBuilder);
    private api = inject(ApiService);
    private toastr = inject(ToastService);
    private dialogRef = inject(MatDialogRef<EditarAsistenciaDialog>);
    readonly data = inject<AsistenciaPersonalRow>(MAT_DIALOG_DATA);

    busy = signal(false);
    error = signal('');

    esJustificado = computed(() => this.form.get('estado')?.value === 'justificado');

    form = this.fb.group({
        estado: [this.data.estado, Validators.required],
        hora_entrada: [this.data.hora_entrada ?? ''],
        hora_salida: [this.data.hora_salida ?? ''],
        motivo_justificacion: [this.data.motivo_justificacion ?? ''],
        observacion: [this.data.observacion ?? ''],
    });

    submit(): void {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }

        const v = this.form.getRawValue();

        if (v.estado === 'justificado' && !v.motivo_justificacion?.trim()) {
            this.form.get('motivo_justificacion')?.setErrors({ required: true });
            this.form.get('motivo_justificacion')?.markAsTouched();
            return;
        }

        this.busy.set(true);
        this.error.set('');

        const payload: Record<string, any> = { estado: v.estado };
        payload['hora_entrada'] = v.hora_entrada?.trim() ? v.hora_entrada : null;
        payload['hora_salida'] = v.hora_salida?.trim() ? v.hora_salida : null;
        payload['motivo_justificacion'] = v.motivo_justificacion?.trim() ? v.motivo_justificacion : null;
        payload['observacion'] = v.observacion?.trim() ? v.observacion : null;

        this.api.patch(`fichaje/${this.data.id}`, payload).subscribe({
            next: () => {
                this.toastr.success('Marcación de asistencia actualizada de manera conforme.', '¡Éxito!');
                this.dialogRef.close(true);
                this.busy.set(false);
            },
            error: (err) => {
                const msg = err?.error?.message ?? 'Ocurrió un error inesperado al procesar la actualización.';
                this.error.set(Array.isArray(msg) ? msg.join(', ') : msg);
                this.busy.set(false);
            },
        });
    }
}