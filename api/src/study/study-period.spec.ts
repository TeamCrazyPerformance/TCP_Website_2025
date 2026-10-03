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

  it.each(['2026.03 ~ 2026.05', '2026.3-2026.5', '2026-03 ~ 2026-05'])(
    'supports the month-only period %s through the last day in Seoul',
    (period) => {
      expect(
        calculateStudyPeriodProgress(period, new Date('2026-05-31T14:59:59.999Z')),
      ).toEqual({ progress: 100, status: 'ongoing' });
      expect(
        calculateStudyPeriodProgress(period, new Date('2026-05-31T15:00:00.000Z')),
      ).toEqual({ progress: 100, status: 'completed' });
    },
  );

  it('keeps the full-date period ongoing until the end of the final day in Seoul', () => {
    const period = '2026.09.10 ~ 2026.09.20';

    expect(
      calculateStudyPeriodProgress(period, new Date('2026-09-09T15:00:00.000Z')),
    ).toEqual({ progress: 0, status: 'ongoing' });
    expect(
      calculateStudyPeriodProgress(period, new Date('2026-09-20T14:59:59.999Z')),
    ).toEqual({ progress: 100, status: 'ongoing' });
  });

  it.each([
    null,
    '',
    'not-a-period',
    '8주',
    '2026.02.30 ~ 2026.03.20',
    '2026.09.20 ~ 2026.09.10',
    '2026.13 ~ 2026.14',
    '2026.12 ~ 2026.01',
  ])('does not guess the status of an absent or invalid period: %s', (period) => {
    expect(
      calculateStudyPeriodProgress(
        period,
        new Date('2026-09-15T00:00:00.000Z'),
      ),
    ).toEqual({ progress: 0, status: 'unknown' });
  });
});
