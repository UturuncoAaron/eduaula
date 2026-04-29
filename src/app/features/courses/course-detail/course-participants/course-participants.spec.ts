import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseParticipants } from './course-participants';

describe('CourseParticipants', () => {
  let component: CourseParticipants;
  let fixture: ComponentFixture<CourseParticipants>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseParticipants],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseParticipants);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
