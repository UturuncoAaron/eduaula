import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-doc-type-selector',
  standalone: true,
  imports: [MatSelectModule, MatFormFieldModule, FormsModule],
  templateUrl: './doc-type-selector.html',
  styles: [`.full { width: 100%; }`],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DocTypeSelector),
    multi: true,
  }],
})
export class DocTypeSelector implements ControlValueAccessor {
  value = 'dni';
  onChange = (_: any) => { };
  onTouched = () => { };
  writeValue(v: any) { this.value = v; }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
}