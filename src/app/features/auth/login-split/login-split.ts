import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BrandPanel } from './components/brand-panel/brand-panel';
import { FormPanel } from './components/form-panel/form-panel';

@Component({
  selector: 'app-login-split',
  standalone: true,
  imports: [BrandPanel, FormPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-split.html',
  styleUrl: './login-split.scss',
})
export class LoginSplit {}