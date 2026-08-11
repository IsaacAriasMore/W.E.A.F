const PRIORITY = ['gamma', 'beta', 'alpha'];

export function availableDifficulties(boss) {
  return Object.keys(boss?.requirements || {}).sort((a, b) => {
    const pa = PRIORITY.indexOf(a);
    const pb = PRIORITY.indexOf(b);
    return (pa === -1 ? PRIORITY.length : pa) - (pb === -1 ? PRIORITY.length : pb) || a.localeCompare(b);
  });
}

export function currentDifficulty(boss, preferred) {
  const variants = availableDifficulties(boss);
  if (variants.length === 0) return null;
  return variants.includes(preferred) ? preferred : variants[0];
}
