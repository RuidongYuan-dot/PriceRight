import { expect, it } from "vitest";
import { shanghaiCalendarDate } from "../../lib/time/shanghai-date";

it("按东八区日历日取值，跨日和跨年都不看运行环境时区", () => {
  expect(shanghaiCalendarDate(new Date("2026-11-19T15:59:59.000Z"))).toBe("2026-11-19");
  expect(shanghaiCalendarDate(new Date("2026-11-19T16:00:00.000Z"))).toBe("2026-11-20");
  expect(shanghaiCalendarDate(new Date("2026-12-31T15:59:59.000Z"))).toBe("2026-12-31");
  expect(shanghaiCalendarDate(new Date("2026-12-31T16:00:00.000Z"))).toBe("2027-01-01");
});
