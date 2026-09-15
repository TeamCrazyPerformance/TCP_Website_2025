import { isStudyRecruitmentClosed } from "./studyDashboard";

describe("isStudyRecruitmentClosed", () => {
  it("keeps recruitment open through the deadline date", () => {
    expect(
      isStudyRecruitmentClosed(
        "2026-09-15T00:00:00.000Z",
        new Date("2026-09-15T14:59:00.000Z"),
      ),
    ).toBe(false);
  });

  it("closes recruitment after the deadline date", () => {
    expect(
      isStudyRecruitmentClosed(
        "2026-09-15T00:00:00.000Z",
        new Date("2026-09-15T15:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not report missing or invalid deadlines as closed", () => {
    const now = new Date("2026-09-15T15:00:00.000Z");

    expect(isStudyRecruitmentClosed(null, now)).toBe(false);
    expect(isStudyRecruitmentClosed("invalid", now)).toBe(false);
  });
});
