export function calculateMutationCount(previousValue, newValue) {
  const previous = Number(previousValue);
  const next = Number(newValue);
  if (!Number.isInteger(previous) || !Number.isInteger(next)) {
    return { valid: false, error: 'invalid_values', previous, next };
  }
  const delta = next - previous;
  if (delta <= 0) return { valid: false, error: 'not_improved', previous, next, delta };
  if (delta < 2) return { valid: false, error: 'delta_too_small', previous, next, delta };
  return {
    valid: true,
    previous,
    next,
    delta,
    mutationCount: Math.floor(delta / 2),
    isOdd: delta % 2 !== 0,
  };
}
