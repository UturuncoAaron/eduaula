import { Component, inject, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimeAgoPipe } from '../../pipes/time-ago-pipe';
import {
  NotificationsStore,
  NotificationItem,
} from '../../../core/services/notifications-store';
import {
  iconForType,
  colorForType,
  routeForReferenceType,
} from '../../utils/notifications-helpers';

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    RouterLink,
    TimeAgoPipe,
  ],
  templateUrl: './notifications-bell.html',
  styleUrl: './notifications-bell.scss',
})
export class NotificationsBell {
  private store = inject(NotificationsStore);
  private router = inject(Router);

  @ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;

  items = this.store.items;
  unreadCount = this.store.unreadCount;

  onMenuOpened() {
    if (this.items().length === 0) {
      this.store.refresh();
    }
  }

  onItemClick(n: NotificationItem) {
    if (!n.read) this.store.markOneAsRead(n.id);
    const target = routeForReferenceType(n.referenceType);
    if (target) this.router.navigate([target]);
    this.closeMenu();
  }

  onMarkAll(ev: Event) {
    ev.stopPropagation();
    this.store.markAllAsRead();
  }

  closeMenu() {
    this.menuTrigger?.closeMenu();
  }

  iconFor = iconForType;
  colorFor = colorForType;
}