import { calculateStudyPeriodProgress } from './study-period';

describe('calculateStudyPeriodProgress', () => {
  it('classifies the current dotted full-date format', () => {
    const period = '2026.09.10 ~ 2026.09.20';

    expect(
      calculateStudyPeriodProgress(
        period,
        new Date('2026-09-09T03:00:00.000Z'),
      ),
    ).toEqual({ progress: 0, status: 'upcoming' });
    expect(
      calculateStudyPeriodProgress(
        period,
        new Date('2026-09-15T03:00:00.000Z'),
      ),
    ).toEqual({ progress: 50, status: 'ongoing' });
    expect(
      calculateStudyPeriodProgress(
        period,
        new Date('2026-09-20T15:00:00.000Z'),
      ),
    ).toEqual({ progress: 100, status: 'completed' });
  });

  it('supports ISO full-date and legacy month-only periods', () => {
    expect(
      calculateStudyPeriodProgress(
        '2026-09-10 ~ 2026-09-20',
        new Date('2026-09-15T03:00:00.000Z'),
      ),
    ).toEqual({ progress: 50, status: 'ongoing' });

    expect(
      calculateStudyPeriodProgress(
        '2026.01-2026.03',
        new Date('2026-03-31T15:00:00.000Z'),
      ),
    ).toEqual({ progress: 100, status: 'completed' });
  });

  it('keeps unparseable legacy data visible as an ongoing study', () => {
    expect(
      calculateStudyPeriodProgress(
        'not-a-period',
        new Date('2026-09-15T00:00:00.000Z'),
      ),
    ).toEqual({ progress: 0, status: 'ongoing' });
  });
});
