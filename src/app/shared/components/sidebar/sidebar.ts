import {
  Component, inject, input, computed, signal,
  ChangeDetectionStrategy, OnInit, OnDestroy,
} from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';

import { AuthService } from '../../../core/auth/auth';
import { hasAnyModulo } from '../../../core/auth/modulos';
import { NAV_ITEMS, NavItem } from './navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    NgOptimizedImage,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private routerSub!: Subscription;

  collapsed = input<boolean>(false);

  user = computed(() => this.auth.currentUser());

  expandedGroups = signal<Record<string, boolean>>({});
  currentUrl = signal(this.normalizeUrl(this.router.url));

  visibleItems = computed(() => {
    const modulos = this.user()?.modulos ?? [];
    if (!modulos.length) return [];
    return this.filterByModulos(NAV_ITEMS, modulos);
  });

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.currentUrl.set(this.normalizeUrl(e.urlAfterRedirects));
        this.autoExpandActiveRoute();
      });
    this.autoExpandActiveRoute();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  toggleGroup(label: string): void {
    this.expandedGroups.update(state => ({ ...state, [label]: !state[label] }));
  }

  isExpanded(label: string): boolean {
    return !!this.expandedGroups()[label];
  }

  isGroupActive(item: NavItem): boolean {
    return item.children ? this.hasActiveChild(item.children) : false;
  }

  isItemActive(item: NavItem): boolean {
    if (!item.route) return false;
    const url = this.currentUrl();
    return item.exactMatch ? url === item.route : url.startsWith(item.route);
  }

  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  private filterByModulos(items: NavItem[], userModulos: string[]): NavItem[] {
    return items
      .filter(i => hasAnyModulo(userModulos, i.modulos))
      .map(i =>
        i.children
          ? { ...i, children: this.filterByModulos(i.children, userModulos) }
          : i,
      )
      .filter(i => !i.children || i.children.length > 0);
  }

  private hasActiveChild(children: NavItem[]): boolean {
    return children.some(child =>
      (child.route && this.isItemActive(child)) ||
      (child.children ? this.hasActiveChild(child.children) : false),
    );
  }

  private autoExpandActiveRoute(): void {
    const state: Record<string, boolean> = { ...this.expandedGroups() };
    this.markExpanded(this.visibleItems(), state);
    this.expandedGroups.set(state);
  }

  private markExpanded(items: NavItem[], state: Record<string, boolean>): boolean {
    for (const item of items) {
      if (item.children) {
        if (this.markExpanded(item.children, state)) {
          state[item.label] = true;
          return true;
        }
      } else if (item.route && this.isItemActive(item)) {
        return true;
      }
    }
    return false;
  }
}
