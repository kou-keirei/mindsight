export const TIME_OF_DAY_TAGS = {
  LATE_NIGHT: "late_night",
  EARLY_MORNING: "early_morning",
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
  LATE_EVENING: "late_evening",
};

export function getTimeOfDayTag(date) {
  const resolved = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(resolved.getTime())) {
    return "";
  }

  const hour = resolved.getHours();
  if (hour >= 0 && hour <= 3) return TIME_OF_DAY_TAGS.LATE_NIGHT;
  if (hour >= 4 && hour <= 7) return TIME_OF_DAY_TAGS.EARLY_MORNING;
  if (hour >= 8 && hour <= 11) return TIME_OF_DAY_TAGS.MORNING;
  if (hour >= 12 && hour <= 16) return TIME_OF_DAY_TAGS.AFTERNOON;
  if (hour >= 17 && hour <= 20) return TIME_OF_DAY_TAGS.EVENING;
  return TIME_OF_DAY_TAGS.LATE_EVENING;
}

