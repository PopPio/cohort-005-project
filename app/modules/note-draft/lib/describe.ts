export type NoteDraft = {
  length: number;
  limit: number;
  empty: boolean;
  tooLong: boolean;
  canSave: boolean;
};

export function describe(body: string, limit: number): NoteDraft {
  // The server trims before it checks both rules, so count what it will save.
  const length = body.trim().length;
  const empty = length === 0;
  const tooLong = length > limit;
  return {
    length,
    limit,
    empty,
    tooLong,
    canSave: !empty && !tooLong,
  };
}
