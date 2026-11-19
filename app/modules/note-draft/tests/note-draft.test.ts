import { describe, it, expect } from "vitest";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeNoteDraft } from "../index";

describe("describeNoteDraft", () => {
  it("counts the characters against the note limit", () => {
    const draft = describeNoteDraft("Remember Result<T>");
    expect(draft.length).toBe(18);
    expect(draft.limit).toBe(MAX_NOTE_LENGTH);
  });

  it("lets a note with text be saved", () => {
    const draft = describeNoteDraft("Remember Result<T>");
    expect(draft).toMatchObject({
      empty: false,
      tooLong: false,
      canSave: true,
    });
  });

  it("does not let an empty note be saved", () => {
    expect(describeNoteDraft("")).toMatchObject({
      empty: true,
      canSave: false,
    });
  });

  it("treats a note of only whitespace as empty", () => {
    expect(describeNoteDraft("  \n\t ")).toMatchObject({
      empty: true,
      canSave: false,
    });
  });

  it("allows a note of exactly the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH));
    expect(draft).toMatchObject({ tooLong: false, canSave: true });
  });

  it("does not let a note one character over the limit be saved", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1));
    expect(draft).toMatchObject({ tooLong: true, canSave: false });
  });

  it("does not count surrounding whitespace against the limit", () => {
    const draft = describeNoteDraft(`${"a".repeat(MAX_NOTE_LENGTH)}\n`);
    expect(draft).toMatchObject({
      length: MAX_NOTE_LENGTH,
      tooLong: false,
      canSave: true,
    });
  });
});
