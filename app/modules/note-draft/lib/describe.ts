export type NoteDraft = {
  length: number;
  limit: number;
  empty: boolean;
  tooLong: boolean;
  canSave: boolean;
};

export function describe(body: string, limit: number): NoteDraft {
  // The server trims before it checks, so a note of only spaces is empty.
  const empty = body.trim().length === 0;
  const tooLong = body.length > limit;
  return {
    length: body.length,
    limit,
    empty,
    tooLong,
    canSave: !empty && !tooLong,
  };
}
