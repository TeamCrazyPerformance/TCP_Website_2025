const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const seoulDate = (year, month, day, endOfDay = false) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return date.getTime() - SEOUL_UTC_OFFSET_MS + (endOfDay ? DAY_MS - 1 : 0);
};

export const studyPeriodStatus = (period, now = new Date()) => {
  if (typeof period !== "string" || !period.trim()) return "unknown";
  const normalized = period.trim();
  const fullDates = normalized.match(
    /^(\d{4})[.-](\d{2})[.-](\d{2})\s*~\s*(\d{4})[.-](\d{2})[.-](\d{2})$/,
  );
  const months = normalized.match(
    /^(\d{4})[.-](\d{1,2})\s*[~-]\s*(\d{4})[.-](\d{1,2})$/,
  );
  let start;
  let end;

  if (fullDates) {
    const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = fullDates.map(Number);
    start = seoulDate(startYear, startMonth, startDay);
    end = seoulDate(endYear, endMonth, endDay, true);
  } else if (months) {
    const [, startYear, startMonth, endYear, endMonth] = months.map(Number);
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return "unknown";
    const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
    start = seoulDate(startYear, startMonth, 1);
    end = seoulDate(endYear, endMonth, lastDay, true);
  } else {
    return "unknown";
  }

  if (start === null || end === null || end < start) return "unknown";
  if (now.getTime() < start) return "upcoming";
  if (now.getTime() > end) return "completed";
  return "ongoing";
};
