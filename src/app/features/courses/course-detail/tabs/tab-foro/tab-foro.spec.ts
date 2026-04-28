import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabForo } from './tab-foro';

describe('TabForo', () => {
  let component: TabForo;
  let fixture: ComponentFixture<TabForo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabForo],
    }).compileComponents();

    fixture = TestBed.createComponent(TabForo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
