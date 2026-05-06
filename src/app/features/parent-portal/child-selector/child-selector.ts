import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/auth/auth';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../stores/parent-portal.store';
import { Child } from '../../../core/models/parent-portal';

@Component({
  selector: 'app-child-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    PageHeader, EmptyState,
  ],
  templateUrl: './child-selector.html',
  styleUrl: './child-selector.scss',
})
export class ChildSelector implements OnInit {
  readonly auth = inject(AuthService);
  private store = inject(ParentPortalService);

  readonly children = signal<Child[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    this.store.getChildren().subscribe({
      next: r => {
        this.children.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.children.set([]);
        this.loading.set(false);
      },
    });
  }

  initials(c: Child): string {
    return ((c.nombre?.[0] ?? '') + (c.apellido_paterno?.[0] ?? '')).toUpperCase();
  }

  fullName(c: Child): string {
    return `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno ?? ''}`.trim();
  }
}
