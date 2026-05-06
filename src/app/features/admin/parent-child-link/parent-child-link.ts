import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError, tap, map } from 'rxjs/operators';
import { of } from 'rxjs';

import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';

// Estructura real que devuelve el backend
export interface UserSearchResult {
  id: string;
  numero_documento?: string;  // alumnos no tienen este campo directo — viene de cuenta
  codigo_estudiante?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
}

interface RecentLink {
  id: string;
  padre: string;
  alumno: string;
}

// Normaliza la respuesta del backend al formato que usa el template
function normalizeUser(u: any): UserSearchResult {
  return {
    id: u.id,
    numero_documento: u.numero_documento ?? u.codigo_estudiante ?? u.id,
    codigo_estudiante: u.codigo_estudiante,
    nombre: u.nombre,
    apellido_paterno: u.apellido_paterno,
    apellido_materno: u.apellido_materno,
  };
}

// Extrae el array de resultados sin importar el nivel de anidamiento
function extractArray(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

@Component({
  selector: 'app-parent-child-link',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatAutocompleteModule, MatProgressSpinnerModule, PageHeader,
  ],
  templateUrl: './parent-child-link.html',
  styleUrl: './parent-child-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParentChildLink {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  loading = signal(false);
  isSearchingPadre = signal(false);
  isSearchingAlumno = signal(false);
  recentLinks = signal<RecentLink[]>([]);

  form = this.fb.group({
    padre: this.fb.control<UserSearchResult | string | null>(null, Validators.required),
    alumno: this.fb.control<UserSearchResult | string | null>(null, Validators.required),
  });

  formValues = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  isValidForm = computed(() => {
    const { padre, alumno } = this.formValues();
    return !!(
      padre && typeof padre === 'object' && (padre as UserSearchResult).id &&
      alumno && typeof alumno === 'object' && (alumno as UserSearchResult).id
    );
  });

  padresSugeridos = toSignal(
    this.form.controls.padre.valueChanges.pipe(
      filter(val => typeof val === 'string' && val.trim().length >= 2),
      tap(() => this.isSearchingPadre.set(true)),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query =>
        this.api.get<any>(`admin/users/padres/search?q=${encodeURIComponent(query as string)}`).pipe(
          map(res => extractArray(res).map(normalizeUser)),
          catchError(() => of([])),
        )
      ),
      tap(() => this.isSearchingPadre.set(false)),
    ),
    { initialValue: [] as UserSearchResult[] },
  );

  alumnosSugeridos = toSignal(
    this.form.controls.alumno.valueChanges.pipe(
      filter(val => typeof val === 'string' && val.trim().length >= 2),
      tap(() => this.isSearchingAlumno.set(true)),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query =>
        this.api.get<any>(`admin/users/alumnos/search?q=${encodeURIComponent(query as string)}`).pipe(
          map(res => extractArray(res).map(normalizeUser)),
          catchError(() => of([])),
        )
      ),
      tap(() => this.isSearchingAlumno.set(false)),
    ),
    { initialValue: [] as UserSearchResult[] },
  );

  /** Texto que muestra el input cuando se selecciona una opción */
  displayFn(user: UserSearchResult | null): string {
    if (!user || typeof user !== 'object') return '';
    const doc = user.numero_documento ?? user.codigo_estudiante ?? '';
    const nombre = `${user.nombre} ${user.apellido_paterno}${user.apellido_materno ? ' ' + user.apellido_materno : ''}`;
    return doc ? `${doc} — ${nombre}` : nombre;
  }

  limpiarCampo(campo: 'padre' | 'alumno', event: Event) {
    event.stopPropagation();
    this.form.controls[campo].setValue(null);
  }

  submit() {
    if (!this.isValidForm()) return;
    this.loading.set(true);

    const padre = this.form.controls.padre.value as UserSearchResult;
    const alumno = this.form.controls.alumno.value as UserSearchResult;

    this.api.post<{ padre: string; alumno: string }>('admin/users/parent-child', {
      padre_doc: padre.numero_documento ?? padre.id,
      alumno_doc: alumno.numero_documento ?? alumno.codigo_estudiante ?? alumno.id,
    }).subscribe({
      next: () => {
        this.recentLinks.update(links => [
          {
            id: Date.now().toString(),
            padre: `${padre.nombre} ${padre.apellido_paterno}`,
            alumno: `${alumno.nombre} ${alumno.apellido_paterno}`,
          },
          ...links.slice(0, 9),
        ]);
        this.toastr.success('Vínculo creado exitosamente', 'Éxito');
        this.form.reset();
        this.loading.set(false);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message ?? 'Error al vincular', 'Error');
        this.loading.set(false);
      },
    });
  }
}