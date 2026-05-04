import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';

export type TipoNota =
  | 'examen' | 'tarea' | 'practica'
  | 'participacion' | 'proyecto' | 'otro';

export interface NewActividadResult {
  titulo: string;
  tipo: TipoNota;
  fecha: string | null; // YYYY-MM-DD
}

interface DialogData {
  existing: string[];
}

interface TipoOpt {
  value: TipoNota;
  label: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-new-actividad-dialog',
  imports: [
    FormsModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  templateUrl: './new-actividad-dialog.html',
  styleUrl: './new-actividad-dialog.scss',
})
export class NewActividadDialog {
  private dialogRef = inject(MatDialogRef<NewActividadDialog>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  titulo = '';
  tipo: TipoNota = 'examen';
  fecha: Date | null = null;

  duplicate = signal(false);

  readonly tipos: TipoOpt[] = [
    { value: 'examen', label: 'Examen', icon: 'description', color: '#1976d2' },
    { value: 'tarea', label: 'Tarea', icon: 'assignment', color: '#2e7d32' },
    { value: 'practica', label: 'Práctica', icon: 'edit_note', color: '#ed6c02' },
    { value: 'participacion', label: 'Participación', icon: 'forum', color: '#9c27b0' },
    { value: 'proyecto', label: 'Proyecto', icon: 'rocket_launch', color: '#d32f2f' },
    { value: 'otro', label: 'Otro', icon: 'star', color: '#616161' },
  ];

  onTitleChange() {
    const t = this.titulo.trim().toLowerCase();
    this.duplicate.set(
      this.data.existing.some(e => e.toLowerCase() === t),
    );
  }

  selectTipo(t: TipoNota) {
    this.tipo = t;
  }

  canSave(): boolean {
    return (
      this.titulo.trim().length > 0 &&
      this.titulo.length <= 200 &&
      !this.duplicate()
    );
  }

  save() {
    if (!this.canSave()) return;
    this.dialogRef.close({
      titulo: this.titulo.trim(),
      tipo: this.tipo,
      fecha: this.fecha
        ? this.fecha.toISOString().slice(0, 10)
        : null,
    } satisfies NewActividadResult);
  }

  cancel() { this.dialogRef.close(null); }
}
