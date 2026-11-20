import { expect, it } from "vitest";
import { decodeShareQuery, encodeShareQuery } from "../../lib/share/query";
import { loadDemo } from "../demo";

it("往返保留答案类型，并安全丢弃不可选地区和非法参数", async () => {
  const { service, answers, data } = await loadDemo();
  const regions = data.regions;
  const query = encodeShareQuery(service, answers, "beijing", "2026-11-20");
  expect(decodeShareQuery(service, regions, query)).toMatchObject({
    regionId: "beijing",
    asOf: "2026-11-20",
    answers,
  });
  expect(decodeShareQuery(service, regions, "https://example.com/estimate/x" + query + "#result").answers.quantity).toBe(2);
  expect(decodeShareQuery(service, regions, query).answers["remove-old"]).toBe(false);

  for (const city of ["guangdong", "first-tier", "unknown", "<script>", ""]) {
    const decoded = decodeShareQuery(service, regions, `?city=${encodeURIComponent(city)}&asOf=2026-11-20`);
    expect(decoded.regionId).toBeUndefined();
    expect(decoded.asOf).toBe("2026-11-20");
  }
  expect(decodeShareQuery(service, regions, "?city=cn&asOf=2026-02-31&a.quantity=-999").regionId).toBe("cn");
  expect(decodeShareQuery(service, regions, "?city=cn&asOf=2026-02-31").asOf).toBeUndefined();
  expect(decodeShareQuery(service, regions, "?city=beijing&a.quantity=-999&a.lamp-type=nope").answers).toEqual({});
  expect(decodeShareQuery(service, regions, "?city=beijing&asOf=yesterday&a.quantity=2").asOf).toBeUndefined();
  expect(decodeShareQuery(service, regions, "?city=beijing&a.quantity=2").answers.quantity).toBe(2);

  const multiple = structuredClone(service);
  multiple.questions = [
    ...multiple.questions,
    {
      id: "extras",
      type: "multiple",
      title: "附加",
      required: false,
      options: [
        { id: "a", label: "甲", value: "a" },
        { id: "b", label: "乙", value: "b" },
      ],
    },
  ];
  const withExtras = { ...answers, extras: ["b", "a"] };
  const encoded = encodeShareQuery(multiple, withExtras, "cn", "2026-11-20");
  expect(decodeShareQuery(multiple, regions, encoded).answers.extras).toEqual(["b", "a"]);
  expect(decodeShareQuery(multiple, regions, "?a.extras=a&a.extras=a").answers.extras).toBeUndefined();
});
