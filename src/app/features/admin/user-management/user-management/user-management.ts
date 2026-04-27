import { Component, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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

const TAB_ROLES: UserRole[] = ['admin', 'alumno', 'docente', 'padre'];

@Component({
  selector: 'app-user-management',
  imports: [
    ReactiveFormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatTabsModule, MatDialogModule,
    TabAlumnos, TabDocentes, TabPadres, TabAdmins,
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  stats = signal<UserStats>({ alumnos: 0, docentes: 0, padres: 0, admins: 0 });
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  /** Índice del tab activo (0=admins, 1=alumnos, 2=docentes, 3=padres) */
  activeTabIndex = signal<number>(0);

  /** Helpers para pasar [active] a cada tab hijo */
  isTabActive = (index: number) => this.activeTabIndex() === index;

  ngOnInit() {
    this.loadStats();
    this.searchControl.valueChanges.subscribe(val => {
      this.searchQuery.set(val?.trim().toLowerCase() ?? '');
    });
  }

  loadStats() {
    this.api.get<UserStats>('admin/users/stats').subscribe({
      next: (res) => this.stats.set(res.data),
      error: () => console.error('Error cargando estadísticas'),
    });
  }

  onTabChange(index: number) {
    this.activeTabIndex.set(index);
  }

  get activeRole(): UserRole {
    return TAB_ROLES[this.activeTabIndex()];
  }

  openCreateUser() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '680px',
      disableClose: true,
      data: { rol: this.activeRole },
    });

    dialogRef.afterClosed().subscribe((created: boolean) => {
      if (created) {
        this.loadStats();
        // Forzar recarga del tab activo re-emitiendo el índice
        const current = this.activeTabIndex();
        this.activeTabIndex.set(-1);
        setTimeout(() => this.activeTabIndex.set(current), 0);
      }
    });
  }
}