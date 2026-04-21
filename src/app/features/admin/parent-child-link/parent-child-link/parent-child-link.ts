import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError, tap, map } from 'rxjs/operators';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

export interface UserSearchResult {
  documento: string;
  nombres: string;
  apellidos: string;
}

interface RecentLink {
  id: string;
  padre: string;
  alumno: string;
}

@Component({
  selector: 'app-parent-child-link',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule,
    MatAutocompleteModule, MatProgressSpinnerModule, PageHeader,
  ],
  templateUrl: './parent-child-link.html',
  styleUrl: './parent-child-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParentChildLink {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  isSearchingPadre = signal(false);
  isSearchingAlumno = signal(false);
  recentLinks = signal<RecentLink[]>([]);

  form = this.fb.group({
    padre: this.fb.control<UserSearchResult | string | null>(null, [Validators.required]),
    alumno: this.fb.control<UserSearchResult | string | null>(null, [Validators.required]),
  });

  // 🐛 AQUÍ ESTÁ LA SOLUCIÓN AL BOTÓN: Convertimos los cambios del form a una Señal
  formValues = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  // Validamos leyendo la señal reactiva
  isValidForm = computed(() => {
    const vals = this.formValues();
    const p = vals.padre as any;
    const a = vals.alumno as any;
    return !!(p && typeof p === 'object' && p.documento && a && typeof a === 'object' && a.documento);
  });

  padresSugeridos = toSignal(
    this.form.controls.padre.valueChanges.pipe(
      filter(val => typeof val === 'string' && val.trim().length >= 3),
      tap(() => this.isSearchingPadre.set(true)),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.api.get<any>(`admin/users/search?q=${query}&role=padre`).pipe(
        map(res => Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []))),
        catchError(() => of([]))
      )),
      tap(() => this.isSearchingPadre.set(false))
    ),
    { initialValue: [] }
  );

  alumnosSugeridos = toSignal(
    this.form.controls.alumno.valueChanges.pipe(
      filter(val => typeof val === 'string' && val.trim().length >= 3),
      tap(() => this.isSearchingAlumno.set(true)),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.api.get<any>(`admin/users/search?q=${query}&role=alumno`).pipe(
        map(res => Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []))),
        catchError(() => of([]))
      )),
      tap(() => this.isSearchingAlumno.set(false))
    ),
    { initialValue: [] }
  );

  displayFn(user: UserSearchResult | null): string {
    return user ? `${user.documento} — ${user.nombres} ${user.apellidos}` : '';
  }

  limpiarCampo(campo: 'padre' | 'alumno', event: Event) {
    event.stopPropagation();
    this.form.controls[campo].setValue(null);
  }

  submit() {
    if (!this.isValidForm()) return;

    this.loading.set(true);
    const padreDoc = (this.form.controls.padre.value as UserSearchResult).documento;
    const alumnoDoc = (this.form.controls.alumno.value as UserSearchResult).documento;

    this.api.post<{ padre: string; alumno: string }>('admin/users/parent-child', {
      padre_doc: padreDoc,
      alumno_doc: alumnoDoc
    }).subscribe({
      next: (r) => {
        this.recentLinks.update(links => [
          { id: Date.now().toString(), padre: r.data.padre, alumno: r.data.alumno },
          ...links.slice(0, 9),
        ]);
        this.snack.open(`Vínculo exitoso: ${r.data.padre} y ${r.data.alumno}`, 'Cerrar', { duration: 4000 });
        this.form.reset();
        this.loading.set(false);
      },
      error: (err) => {
        this.snack.open(err?.error?.message ?? 'Ocurrió un error al vincular.', 'Cerrar', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}