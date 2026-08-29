import React from "react";
import { render, screen } from "@testing-library/react";
import { QualityScoreAxes } from "./ArticleQualityPanel";
import PublicValueScoreBreakdown from "./PublicValueScoreBreakdown";

describe("QualityScoreAxes", () => {
  it("renders arbitrary server supplied axes in server order", () => {
    const axes = [
      {
        key: "novelty",
        label: "새로움",
        value: 75,
        weight: null,
        contribution: null,
      },
      {
        key: "usefulness",
        label: "실무 활용성",
        value: 92,
        weight: 0.4,
        contribution: 36.8,
      },
    ];

    render(
      <QualityScoreAxes
        score={{ overall: 84, scale: { min: 0, max: 100 }, axes }}
      />,
    );

    const labels = screen.getAllByText(/새로움|실무 활용성/);
    expect(labels.map((node) => node.textContent)).toEqual([
      "새로움",
      "실무 활용성",
    ]);
    expect(screen.getByText("가중치 40% · 기여 36.8")).toBeInTheDocument();
  });

  it("displays the server contribution instead of recalculating it", () => {
    render(
      <QualityScoreAxes
        score={{
          axes: [
            {
              key: "custom",
              label: "사용자 정의 축",
              value: 100,
              weight: 0.5,
              contribution: 7.25,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("가중치 50% · 기여 7.25")).toBeInTheDocument();
    expect(screen.queryByText(/기여 50/)).not.toBeInTheDocument();
  });

  it("uses the separate minimal breakdown contract in the public article view", () => {
    render(
      <PublicValueScoreBreakdown
        breakdown={[{ label: "사용자 정의 축", contribution: 7.25 }]}
      />,
    );

    expect(screen.getByText("7.25")).toBeInTheDocument();
    expect(screen.queryByText("100 / 100")).not.toBeInTheDocument();
    expect(screen.queryByText("최종 기여 점수")).not.toBeInTheDocument();
    expect(screen.queryByText(/가중치/)).not.toBeInTheDocument();
  });
});
