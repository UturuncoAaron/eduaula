import {
  Component, signal, ChangeDetectionStrategy, HostListener,
  OnInit, inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Navbar } from '../../shared/components/navbar/navbar';
import { AuthService } from '../../core/auth/auth';
import { NotificationsStore } from '../../core/services/notifications-store';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayout implements OnInit {
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private notifications = inject(NotificationsStore);

  // El nombre coincide con el HTML.
  // Inicia colapsado (true) si la pantalla es de celular (< 768px).
  collapsed = signal<boolean>(window.innerWidth < 768);

  ngOnInit(): void {
    if (!this.auth.passwordChanged()) {
      this.openChangePasswordDialog();
    }
    // Una sola conexión SSE para toda la app — push de notificaciones
    // en tiempo real, sin polling.
    this.notifications.connect();
  }

  private async openChangePasswordDialog(): Promise<void> {
    const { ChangePasswordDialog } = await import(
      '../../shared/components/change-password-dialog/change-password-dialog'
    );

    const ref = this.dialog.open(ChangePasswordDialog, {
      width: '420px',
      disableClose: true,
      data: { rol: this.auth.currentUser()?.rol ?? '' },
    });

    ref.afterClosed().subscribe((result) => {
      if (result !== true) {
        this.auth.logout();
      }
    });
  }

  toggleSidebar() {
    this.collapsed.update(val => !val);
  }

  closeSidebarOnMobile() {
    if (window.innerWidth < 768) {
      this.collapsed.set(true);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (event.target.innerWidth < 768) {
      this.collapsed.set(true);
    } else {
      this.collapsed.set(false);
    }
  }
}
