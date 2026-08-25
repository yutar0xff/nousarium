import { DEFAULT_MODEL_ID, normalizeModelOptions } from "./models";
import { describe, expect, it } from "vitest";

describe("normalizeModelOptions", () => {
  it("keeps a single Auto when ids and labels collide", () => {
    const models = normalizeModelOptions([
      { id: "Auto", label: "Auto" },
      { id: "auto", label: "auto" },
      { id: "default-auto", label: "Auto" },
      { id: "composer-2.5", label: "Composer 2.5" },
    ]);
    expect(models.filter((model) => model.id === DEFAULT_MODEL_ID)).toEqual([{ id: "auto", label: "Auto" }]);
    expect(models.filter((model) => model.label.toLowerCase() === "auto")).toHaveLength(1);
    expect(models.some((model) => model.id === "composer-2.5")).toBe(true);
  });

  it("inserts Auto when the list has none", () => {
    const models = normalizeModelOptions([{ id: "composer-2.5", label: "Composer 2.5" }]);
    expect(models[0]).toEqual({ id: "auto", label: "Auto" });
  });
});
