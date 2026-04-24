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

// Importamos todos los componentes hijos (rutas relativas estandarizadas)
import { TabAlumnos } from '../tabs/tab-alumnos/tab-alumnos';
import { TabDocentes } from '../tabs/tab-docentes/tab-docentes';
import { TabPadres } from '../tabs/tab-padres/tab-padres';
import { TabAdmins } from '../tabs/tab-admins/tab-admins'; // <-- ¡Aquí está el nuevo tab!

// Agregamos "admins" a la interfaz para coincidir con la BD
interface UserStats {
  alumnos: number;
  docentes: number;
  padres: number;
  admins: number; 
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatTabsModule, MatDialogModule,
    TabAlumnos, TabDocentes, TabPadres, TabAdmins // <-- Registramos TabAdmins aquí
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss'
})
export class UserManagement implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  // Inicializamos todos los contadores en 0
  stats = signal<UserStats>({ alumnos: 0, docentes: 0, padres: 0, admins: 0 });
  searchControl = new FormControl('');
  
  // Señal reactiva que pasaremos a los hijos
  searchQuery = signal<string>('');

  ngOnInit() {
    this.loadStats();

    // Actualizamos la señal reactiva cada vez que el usuario escribe
    this.searchControl.valueChanges.subscribe(val => {
      this.searchQuery.set(val?.trim().toLowerCase() || '');
    });
  }

  loadStats() {
    this.api.get<UserStats>('admin/users/stats').subscribe({
      next: (res) => this.stats.set(res.data),
      error: () => console.error('Error cargando estadísticas')
    });
  }

  openCreateUser() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '700px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Recargar stats y forzar a los hijos a actualizarse si es necesario
        this.loadStats();
        // Un pequeño hack reactivo para forzar el refresh en las tablas hijas:
        this.searchQuery.set(this.searchQuery() + ' '); 
        setTimeout(() => this.searchQuery.set(this.searchQuery().trim()), 50);
      }
    });
  }
}