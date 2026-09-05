export const resolveLineLimitBp = (
  tierCeilingBp: number,
  categoryCeilingBp?: number,
) => Math.min(tierCeilingBp, categoryCeilingBp ?? tierCeilingBp);
