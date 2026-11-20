// 上海没有夏令时，日历日等于 UTC 时刻加 8 小时后的 UTC 年月日。
// 只给界面和分享链接使用；计价引擎不得调用本函数或 Date.now()。
export function shanghaiCalendarDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
