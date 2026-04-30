// ═══════════════════════════════════════════════════════════════
// sidebar.ts — Sidebar con acordeón multinivel
// ═══════════════════════════════════════════════════════════════
import {
  Component, inject, input, computed, signal,
  ChangeDetectionStrategy, OnInit, OnDestroy,
} from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of, filter, Subscription } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';

import { AuthService } from '../../../core/auth/auth';
import { environment } from '../../../../environments/environment';
import { NAV_ITEMS, NavItem, UserRole } from './navigation.config';

@Component({
  selector: 'app-sidebar',
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
  private http = inject(HttpClient);
  private router = inject(Router);
  private routerSub!: Subscription;

  collapsed = input<boolean>(false);

  user = computed(() => this.auth.currentUser());
  isTutor = signal(false);

  /** Estado de expansión de los grupos del acordeón */
  expandedGroups = signal<Record<string, boolean>>({});

  /** URL activa actual (sin query params ni fragments) */
  currentUrl = signal(this.normalizeUrl(this.router.url));

  /** Items filtrados por rol del usuario actual */
  visibleItems = computed(() => {
    const rol = this.user()?.rol as UserRole;
    if (!rol) return [];
    return this.filterByRole(NAV_ITEMS, rol, this.isTutor());
  });

  ngOnInit() {
    const rol = this.user()?.rol as UserRole | undefined;
    if (rol === 'docente' || rol === 'admin') {
      this.http
        .get<unknown | null>(`${environment.apiUrl}/academic/tutoria/me`)
        .pipe(catchError(() => of(null)))
        .subscribe(data => this.isTutor.set(data !== null));
    }

    // Escuchar cada navegación completada
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.currentUrl.set(this.normalizeUrl(e.urlAfterRedirects));
        this.autoExpandActiveRoute();
      });

    // Auto-expandir al cargar
    this.autoExpandActiveRoute();
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  // ─── Acordeón ────────────────────────────────────────────────

  toggleGroup(label: string): void {
    this.expandedGroups.update(state => ({
      ...state,
      [label]: !state[label],
    }));
  }

  isExpanded(label: string): boolean {
    return !!this.expandedGroups()[label];
  }

  /** Verifica si algún hijo del grupo está activo */
  isGroupActive(item: NavItem): boolean {
    if (!item.children) return false;
    return this.hasActiveChild(item.children);
  }

  /** Verifica si un item hoja específico coincide con la URL actual */
  isItemActive(item: NavItem): boolean {
    if (!item.route) return false;
    const url = this.currentUrl();
    // Si el item pide match exacto, comparar exactamente
    if (item.exactMatch) return url === item.route;
    // Sino, usar startsWith para subrutas
    return url.startsWith(item.route);
  }

  // ─── Helpers privados ────────────────────────────────────────

  /** Elimina query params y fragments de una URL */
  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  /** Filtra items recursivamente por rol y condición de tutor */
  private filterByRole(items: NavItem[], rol: UserRole, isTutor: boolean): NavItem[] {
    return items
      .filter(i => i.roles.includes(rol) && (!i.requiresTutor || isTutor))
      .map(i => i.children
        ? { ...i, children: this.filterByRole(i.children, rol, isTutor) }
        : i,
      );
  }

  /** Comprueba recursivamente si algún hijo está activo */
  private hasActiveChild(children: NavItem[]): boolean {
    return children.some(child => {
      if (child.route && this.isItemActive(child)) return true;
      if (child.children) return this.hasActiveChild(child.children);
      return false;
    });
  }

  /** Expande automáticamente los grupos que contienen la ruta activa */
  private autoExpandActiveRoute(): void {
    const state: Record<string, boolean> = { ...this.expandedGroups() };
    this.markExpanded(this.visibleItems(), state);
    this.expandedGroups.set(state);
  }

  /** Recorre el árbol y marca como expandidos los padres del item activo */
  private markExpanded(items: NavItem[], state: Record<string, boolean>): boolean {
    for (const item of items) {
      if (item.children) {
        if (this.markExpanded(item.children, state)) {
          state[item.label] = true;
          return true;
        }
      }
      if (item.route && this.isItemActive(item)) {
         return true;
      }
    }
    return false;
  }
}
