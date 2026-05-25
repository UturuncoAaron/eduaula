import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../core/services/api';

interface LecturaRow {
  lector_id: string;
  nombre: string | null;
  apellidos: string | null;
  rol: string;
  vista_en: string;
  ultima_apertura_en: string;
  veces_vista: number;
}

interface DialogData {
  libretaId: string;
  label: string;
}

@Component({
  selector: 'app-libreta-auditoria-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './libreta-auditoria-dialog.html',
  styleUrl: './libreta-auditoria-dialog.scss',
})
export class LibretaAuditoriaDialog implements OnInit {
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<LibretaAuditoriaDialog>);

  readonly lecturas = signal<LecturaRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.api.get<LecturaRow[]>(`libretas/${this.data.libretaId}/lecturas`).subscribe({
      next: r => {
        this.lecturas.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
