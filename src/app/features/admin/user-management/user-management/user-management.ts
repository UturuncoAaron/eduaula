// ═══════════════════════════════════════════════════════════════
// user-management.ts — Vista de gestión de un tipo de usuario
// Lee :tipo de la ruta y muestra solo la tabla correspondiente
// ═══════════════════════════════════════════════════════════════
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api';
import { CreateUserDialog } from '../../create-user-dialog/create-user-dialog/create-user-dialog';
import { TabAlumnos } from '../tabs/tab-alumnos/tab-alumnos';
import { TabDocentes } from '../tabs/tab-docentes/tab-docentes';
import { TabPadres } from '../tabs/tab-padres/tab-padres';
import { TabAdmins } from '../tabs/tab-admins/tab-admins';

export type UserRole = 'admin' | 'alumno' | 'docente' | 'padre';

export interface UserStats {
  alumnos: number;
  docentes: number;
  padres: number;
  admins: number;
}

/** Mapa de tipo de URL → metadatos de la vista */
interface TipoMeta {
  role: UserRole;
  label: string;
  sublabel: string;
  icon: string;
}

const TIPO_META: Record<string, TipoMeta> = {
  admins:   { role: 'admin',   label: 'Administradores', sublabel: 'Gestiona las cuentas de administración del sistema.', icon: 'admin_panel_settings' },
  alumnos:  { role: 'alumno',  label: 'Alumnos',         sublabel: 'Gestiona las cuentas de estudiantes matriculados.', icon: 'school' },
  docentes: { role: 'docente', label: 'Docentes',        sublabel: 'Gestiona las cuentas del personal docente.',       icon: 'badge' },
  padres:   { role: 'padre',   label: 'Padres / Tutores', sublabel: 'Gestiona las cuentas de padres y apoderados.',    icon: 'family_restroom' },
};

@Component({
  selector: 'app-user-management',
  imports: [
    ReactiveFormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatDialogModule,
    TabAlumnos, TabDocentes, TabPadres, TabAdmins,
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private sub!: Subscription;

  /** Tipo activo leído de la ruta (admins | alumnos | docentes | padres) */
  activeTipo = signal<string>('admins');

  /** Metadata reactiva del tipo activo */
  meta = computed<TipoMeta>(() => TIPO_META[this.activeTipo()] ?? TIPO_META['admins']);

  stats = signal<UserStats>({ alumnos: 0, docentes: 0, padres: 0, admins: 0 });
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  /** Signal que se toglea para forzar recarga del tab hijo */
  reloadTrigger = signal(0);

  ngOnInit() {
    // Escuchar cambios de ruta para actualizar el tipo activo
    this.sub = this.route.paramMap.subscribe(params => {
      const tipo = params.get('tipo') ?? 'admins';
      this.activeTipo.set(tipo);
      this.searchControl.setValue('');
      this.reloadTrigger.update(v => v + 1);
    });

    this.loadStats();
    this.searchControl.valueChanges.subscribe(val => {
      this.searchQuery.set(val?.trim().toLowerCase() ?? '');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadStats() {
    this.api.get<UserStats>('admin/users/stats').subscribe({
      next: (res) => this.stats.set(res.data),
      error: () => console.error('Error cargando estadísticas'),
    });
  }

  openCreateUser() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '680px',
      disableClose: true,
      data: { rol: this.meta().role },
    });

    dialogRef.afterClosed().subscribe((created: boolean) => {
      if (created) {
        this.loadStats();
        this.reloadTrigger.update(v => v + 1);
      }
    });
  }
}