export function deduplicateByIdempotency<T extends { idempotencyKey: string }>(items: readonly T[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.idempotencyKey)) return false;
    seen.add(item.idempotencyKey);
    return true;
  });
}

export function calculateAdherence(events: readonly { taken: boolean }[]) {
  const total = events.length;
  const taken = events.filter(event => event.taken).length;
  return { total, taken, percentage: total ? Math.round((taken / total) * 100) : 0 };
}
