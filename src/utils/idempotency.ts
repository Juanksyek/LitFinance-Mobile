export function createIdempotencyKey(prefix: string = 'lf'): string {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}
