import { describe, expect, it } from "vitest";
import { sendMessageRequestSchema } from "./index";

describe("contracts", () => {
  it("parses send payloads", () => {
    expect(sendMessageRequestSchema.parse({ content: "hello", accessPolicy: "vault" }).content).toBe("hello");
  });
});
