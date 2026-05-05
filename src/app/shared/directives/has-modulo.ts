import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth/auth';
import { Modulo, hasAnyModulo } from '../../core/auth/modulos';

@Directive({ selector: '[hasModulo]', standalone: true })
export class HasModuloDirective implements OnInit {
    @Input() hasModulo: Modulo[] = [];
    private auth = inject(AuthService);
    private tmpl = inject(TemplateRef);
    private vcRef = inject(ViewContainerRef);

    ngOnInit() {
        if (hasAnyModulo(this.auth.currentUser()?.modulos, this.hasModulo)) {
            this.vcRef.createEmbeddedView(this.tmpl);
        }
    }
}
