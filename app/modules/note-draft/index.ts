import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describe, type NoteDraft } from "./lib/describe";

export type { NoteDraft };

/** What the note form shows about the text a Student has typed so far. */
export function describeNoteDraft(body: string): NoteDraft {
  return describe(body, MAX_NOTE_LENGTH);
}
