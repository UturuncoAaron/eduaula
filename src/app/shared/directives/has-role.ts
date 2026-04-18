import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Directive({ selector: '[hasRole]', standalone: true })
export class HasRoleDirective implements OnInit {
  @Input() hasRole: string[] = [];
  private auth = inject(AuthService);
  private tmpl = inject(TemplateRef);
  private vcRef = inject(ViewContainerRef);

  ngOnInit() {
    const rol = this.auth.currentUser()?.rol;
    if (rol && this.hasRole.includes(rol)) {
      this.vcRef.createEmbeddedView(this.tmpl);
    }
  }
}