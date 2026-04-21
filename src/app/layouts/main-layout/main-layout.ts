import { Component, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Navbar } from '../../shared/components/navbar/navbar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush 
})
export class MainLayout {
  // 1. El nombre ahora coincide con el HTML.
  // Inicia colapsado (true) si la pantalla es de celular (< 768px).
  collapsed = signal<boolean>(window.innerWidth < 768);

  toggleSidebar() {
    this.collapsed.update(val => !val);
  }

  // 2. Función para cerrar el menú en móviles al tocar el fondo oscuro
  closeSidebarOnMobile() {
    if (window.innerWidth < 768) {
      this.collapsed.set(true);
    }
  }

  // 3. (Opcional pero muy pro) Escucha si el usuario voltea el celular o redimensiona la ventana
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (event.target.innerWidth < 768) {
      this.collapsed.set(true); // Ocultar en móvil
    } else {
      this.collapsed.set(false); // Mostrar en PC
    }
  }
}