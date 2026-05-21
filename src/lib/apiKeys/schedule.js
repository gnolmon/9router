export const API_KEY_SOURCES = {
  MANUAL: "manual",
  TELEGRAM: "telegram",
};

export const API_KEY_SCHEDULE_MODES = {
  NONE: "none",
  VN_BUSINESS_HOURS: "vn-business-hours",
};

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const ACTIVE_START_MINUTES = 8 * 60;
const ACTIVE_END_MINUTES = 18 * 60 + 30;

export function getVietnamLocalParts(now = new Date()) {
  const shifted = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

export function isVietnamBusinessHours(now = new Date()) {
  const { hours, minutes } = getVietnamLocalParts(now);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= ACTIVE_START_MINUTES && totalMinutes < ACTIVE_END_MINUTES;
}

export function isScheduleActive(scheduleMode, now = new Date()) {
  if (!scheduleMode || scheduleMode === API_KEY_SCHEDULE_MODES.NONE) return true;
  if (scheduleMode === API_KEY_SCHEDULE_MODES.VN_BUSINESS_HOURS) {
    return isVietnamBusinessHours(now);
  }
  return true;
}

export function computeApiKeyIsActive(apiKey, now = new Date()) {
  const manualDisabled = apiKey?.manualDisabled === true;
  if (manualDisabled) return false;
  return isScheduleActive(apiKey?.scheduleMode, now);
}

export function getNextVietnamScheduleTransition(now = new Date()) {
  const parts = getVietnamLocalParts(now);
  const totalMinutes = parts.hours * 60 + parts.minutes;
  let targetHour = 8;
  let targetMinute = 0;
  let dayOffset = 0;

  if (totalMinutes < ACTIVE_START_MINUTES) {
    targetHour = 8;
    targetMinute = 0;
  } else if (totalMinutes < ACTIVE_END_MINUTES) {
    targetHour = 18;
    targetMinute = 30;
  } else {
    targetHour = 8;
    targetMinute = 0;
    dayOffset = 1;
  }

  const shiftedUtcMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day + dayOffset,
    targetHour,
    targetMinute,
    0,
    0
  );
  const actualUtcMs = shiftedUtcMs - VIETNAM_OFFSET_MS;
  return new Date(actualUtcMs);
}

