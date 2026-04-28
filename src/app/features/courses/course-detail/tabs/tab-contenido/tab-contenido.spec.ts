import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabContenido } from './tab-contenido';

describe('TabContenido', () => {
  let component: TabContenido;
  let fixture: ComponentFixture<TabContenido>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabContenido],
    }).compileComponents();

    fixture = TestBed.createComponent(TabContenido);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
