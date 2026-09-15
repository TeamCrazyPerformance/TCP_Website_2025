const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getDeadlineEndOfDay = (deadline) => {
  if (!deadline) return null;

  const dateMatch = String(deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));

    if (
      calendarDate.getUTCFullYear() === year &&
      calendarDate.getUTCMonth() === month - 1 &&
      calendarDate.getUTCDate() === day
    ) {
      const startOfDay = calendarDate.getTime() - SEOUL_UTC_OFFSET_MS;
      return new Date(startOfDay + DAY_MS - 1);
    }

    return null;
  }

  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isStudyRecruitmentClosed = (deadline, now = new Date()) => {
  const deadlineEndOfDay = getDeadlineEndOfDay(deadline);
  return deadlineEndOfDay ? deadlineEndOfDay < now : false;
};
