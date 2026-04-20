import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../core/services/api';
import { User } from '../../../../core/models/user';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { ResetPasswordDialog } from '../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { CreateUserDialog } from '../../create-user-dialog/create-user-dialog/create-user-dialog';

@Component({
  selector: 'app-user-management',
  imports: [
     TitleCasePipe, UpperCasePipe,
    MatTableModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatChipsModule, MatTabsModule,
    MatPaginatorModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule,
    PageHeader,
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  allUsers = signal<User[]>([]);
  loading = signal(true);
  selectedTab = signal(0);
  searchQuery = signal('');
  pageSize = signal(10);
  pageIndex = signal(0);

  cols = ['nombre', 'documento', 'extra', 'estado', 'acciones'];

  tabs = [
    { rol: 'todos', label: 'Todos', icon: 'people' },
    { rol: 'alumno', label: 'Alumnos', icon: 'school' },
    { rol: 'docente', label: 'Docentes', icon: 'person' },
    { rol: 'padre', label: 'Padres', icon: 'family_restroom' },
    { rol: 'admin', label: 'Admins', icon: 'admin_panel_settings' },
  ];

  totalUsuarios = computed(() => this.allUsers().length);

  currentRol = computed(() => this.tabs[this.selectedTab()].rol);

  roleStats = computed(() => [
    { rol: 'alumno', label: 'Alumnos', icon: 'school', count: this.getCount('alumno'), index: 1 },
    { rol: 'docente', label: 'Docentes', icon: 'person', count: this.getCount('docente'), index: 2 },
    { rol: 'padre', label: 'Padres', icon: 'family_restroom', count: this.getCount('padre'), index: 3 },
    { rol: 'admin', label: 'Admins', icon: 'admin_panel_settings', count: this.getCount('admin'), index: 4 },
  ]);

  filteredUsers = computed(() => {
    let list = this.allUsers();
    if (this.currentRol() !== 'todos') {
      list = list.filter(u => u.rol === this.currentRol());
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(u =>
        `${u.nombre} ${u.apellido_paterno}`.toLowerCase().includes(q) ||
        u.numero_documento.includes(q)
      );
    }
    return list;
  });

  paginatedUsers = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.api.get<User[]>('admin/users').subscribe({
      next: r => { this.allUsers.set(r.data); this.loading.set(false); },
      error: () => { this.allUsers.set([]); this.loading.set(false); },
    });
  }

  getCount(rol: string): number {
    if (rol === 'todos') return this.allUsers().length;
    return this.allUsers().filter(u => u.rol === rol).length;
  }

  setTab(index: number) {
    this.selectedTab.set(index);
    this.pageIndex.set(0);
  }

  onTabChange(index: number) {
    this.selectedTab.set(index);
    this.pageIndex.set(0);
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
    this.pageIndex.set(0);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.pageIndex.set(0);
  }

  onPage(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  openCreateUser() {
    const ref = this.dialog.open(CreateUserDialog, {
      width: '680px',
      maxHeight: '90vh',
      disableClose: false,
    });
    ref.afterClosed().subscribe(newUser => {
      if (newUser) {
        this.allUsers.update(u => [newUser, ...u]);
        this.snack.open('Usuario creado correctamente', 'OK', { duration: 2000 });
      }
    });
  }

  toggleActive(user: User) {
    this.api.patch(`admin/users/${user.id}`, { activo: !user.activo }).subscribe({
      next: () => {
        this.allUsers.update(list =>
          list.map(u => u.id === user.id ? { ...u, activo: !u.activo } : u)
        );
        this.snack.open(
          user.activo ? 'Usuario desactivado' : 'Usuario activado',
          'OK', { duration: 2000 }
        );
      },
      error: () => this.snack.open('Error al actualizar', 'OK', { duration: 2000 }),
    });
  }

  resetPassword(user: User) {
    const ref = this.dialog.open(ResetPasswordDialog, {
      data: { userName: `${user.nombre} ${user.apellido_paterno}` },
      width: '400px',
    });
    ref.afterClosed().subscribe(newPass => {
      if (!newPass) return;
      this.api.patch(`admin/users/${user.id}/reset-password`, { password: newPass }).subscribe({
        next: () => this.snack.open('Contraseña actualizada', 'OK', { duration: 2000 }),
        error: () => this.snack.open('Error al resetear contraseña', 'OK', { duration: 2000 }),
      });
    });
  }
}