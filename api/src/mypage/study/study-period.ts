export type StudyPeriodStatus = 'upcoming' | 'ongoing' | 'completed';

export interface StudyPeriodProgress {
  progress: number;
  status: StudyPeriodStatus;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const createSeoulDate = (
  year: number,
  month: number,
  day: number,
  endOfDay = false,
): Date | null => {
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const startOfDay = calendarDate.getTime() - SEOUL_UTC_OFFSET_MS;
  return new Date(endOfDay ? startOfDay + DAY_MS - 1 : startOfDay);
};

const parseFullDateRange = (period: string): DateRange | null => {
  const match = period.match(
    /^(\d{4})[.-](\d{2})[.-](\d{2})\s*~\s*(\d{4})[.-](\d{2})[.-](\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const startDate = createSeoulDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
  const endDate = createSeoulDate(
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    true,
  );

  if (!startDate || !endDate || endDate < startDate) {
    return null;
  }

  return { startDate, endDate };
};

const parseLegacyMonthRange = (period: string): DateRange | null => {
  const match = period.match(/^(\d{4})\.(\d{2})\s*-\s*(\d{4})\.(\d{2})$/);

  if (!match) {
    return null;
  }

  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const endYear = Number(match[3]);
  const endMonth = Number(match[4]);

  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    return null;
  }

  const lastDayOfEndMonth = new Date(
    Date.UTC(endYear, endMonth, 0),
  ).getUTCDate();
  const startDate = createSeoulDate(startYear, startMonth, 1);
  const endDate = createSeoulDate(endYear, endMonth, lastDayOfEndMonth, true);

  if (!startDate || !endDate || endDate < startDate) {
    return null;
  }

  return { startDate, endDate };
};

const parseStudyPeriod = (period?: string | null): DateRange | null => {
  if (!period) {
    return null;
  }

  const normalizedPeriod = period.trim();
  return (
    parseFullDateRange(normalizedPeriod) ||
    parseLegacyMonthRange(normalizedPeriod)
  );
};

export const calculateStudyPeriodProgress = (
  period?: string | null,
  now = new Date(),
): StudyPeriodProgress => {
  const range = parseStudyPeriod(period);

  if (!range) {
    return { progress: 0, status: 'ongoing' };
  }

  const { startDate, endDate } = range;

  if (now < startDate) {
    return { progress: 0, status: 'upcoming' };
  }

  if (now > endDate) {
    return { progress: 100, status: 'completed' };
  }

  const totalTime = endDate.getTime() - startDate.getTime();
  const elapsedTime = now.getTime() - startDate.getTime();
  const progress =
    totalTime === 0 ? 100 : Math.round((elapsedTime / totalTime) * 100);

  return {
    progress: Math.min(Math.max(progress, 0), 100),
    status: 'ongoing',
  };
};
