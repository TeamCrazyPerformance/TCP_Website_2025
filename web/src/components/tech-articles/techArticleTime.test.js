import { formatRelativeFromNow } from "./TechArticleCommon";

const NOW = new Date("2026-08-22T12:00:00Z").getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();

describe("마지막 확인 시각 표기", () => {
  test.each([
    [0, "방금"],
    [30 * 1000, "방금"],
    [12 * 60 * 1000, "12분 전"],
    [59 * 60 * 1000, "59분 전"],
    [3 * 3600 * 1000, "3시간 전"],
    [26 * 3600 * 1000, "1일 전"],
    [6 * 24 * 3600 * 1000, "6일 전"],
  ])("%s ms 전 -> %s", (elapsed, expected) => {
    expect(formatRelativeFromNow(ago(elapsed), NOW)).toBe(expected);
  });

  test("일주일이 넘으면 상대 표현을 포기한다", () => {
    expect(formatRelativeFromNow(ago(9 * 24 * 3600 * 1000), NOW)).toBeNull();
  });

  test("값이 없거나 이상하면 아무것도 그리지 않는다", () => {
    expect(formatRelativeFromNow(null)).toBeNull();
    expect(formatRelativeFromNow(undefined)).toBeNull();
    expect(formatRelativeFromNow("어제쯤")).toBeNull();
  });

  test("시계가 어긋나 미래 시각이 와도 음수로 내려가지 않는다", () => {
    expect(
      formatRelativeFromNow(new Date(NOW + 60000).toISOString(), NOW),
    ).toBe("방금");
  });
});
