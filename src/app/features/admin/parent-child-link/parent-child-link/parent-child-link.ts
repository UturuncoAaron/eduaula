import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

interface RecentLink {
  id: string;
  padre: string;
  alumno: string;
}

@Component({
  selector: 'app-parent-child-link',
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule,
    MatSnackBarModule, PageHeader,
  ],
  templateUrl: './parent-child-link.html',
  styleUrl: './parent-child-link.scss',
})
export class ParentChildLink {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  padreInfo = signal('');
  alumnoInfo = signal('');
  recentLinks = signal<RecentLink[]>([]);

  form = this.fb.group({
    padre_doc: ['', [Validators.required, Validators.minLength(6)]],
    alumno_doc: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.padreInfo.set('');
    this.alumnoInfo.set('');

    this.api.post<{ padre: string; alumno: string }>(
      'admin/users/parent-child', this.form.value
    ).subscribe({
      next: r => {
        this.padreInfo.set(r.data.padre);
        this.alumnoInfo.set(r.data.alumno);
        this.recentLinks.update(links => [
          { id: Date.now().toString(), padre: r.data.padre, alumno: r.data.alumno },
          ...links.slice(0, 9),
        ]);
        this.snack.open(
          `Vínculo creado: ${r.data.padre} → ${r.data.alumno}`,
          'OK', { duration: 4000 }
        );
        this.form.reset();
        this.loading.set(false);
      },
      error: (err) => {
        this.snack.open(
          err?.error?.message ?? 'Error. Verifica los documentos.',
          'OK', { duration: 3000 }
        );
        this.loading.set(false);
      },
    });
  }
}