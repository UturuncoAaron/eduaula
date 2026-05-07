import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TutoringStore } from '../../data-access/tutoring.store';

interface NavTab {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'app-my-tutoring',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [TutoringStore],
  templateUrl: './my-tutoring.html',
  styleUrl: './my-tutoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTutoring implements OnInit {
  readonly store = inject(TutoringStore);

  readonly tabs: readonly NavTab[] = [
    { path: 'alumnos',  label: 'Alumnos',  icon: 'group' },
    { path: 'padres',   label: 'Padres',   icon: 'family_restroom' },
    { path: 'libretas', label: 'Libretas', icon: 'description' },
  ];

  ngOnInit(): void {
    this.store.load();
  }
}