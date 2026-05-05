import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AvatarRole = 'alumno' | 'docente' | 'admin' | 'padre' | 'psicologa' | 'auxiliar';

const ROLE_COLORS: Record<AvatarRole, string> = {
  alumno: '#10b981',
  docente: '#f59e0b',
  admin: '#ef4444',
  padre: '#8b5cf6',
  psicologa: '#0ea5e9',
  auxiliar: '#14b8a6',
};

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar" [style.width.px]="size()" [style.height.px]="size()"
         [style.fontSize.px]="size() * 0.36"
         [style.background]="hasFoto() ? 'transparent' : bgColor()"
         [style.color]="hasFoto() ? 'transparent' : '#fff'">
      @if (hasFoto()) {
        <img [src]="fotoUrl()!" [alt]="initials()" />
      } @else {
        {{ initials() }}
      }
    </div>
  `,
  styles: [`
    .avatar {
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
      overflow: hidden;
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  `],
})
export class UserAvatar {
  nombre = input.required<string>();
  apellidoPaterno = input.required<string>();
  rol = input.required<AvatarRole>();
  fotoUrl = input<string | null>(null);
  size = input<number>(36);

  hasFoto = computed(() => !!this.fotoUrl());
  bgColor = computed(() => ROLE_COLORS[this.rol()] ?? '#64748b');
  initials = computed(() =>
    (this.nombre().charAt(0) + this.apellidoPaterno().charAt(0)).toUpperCase()
  );
}