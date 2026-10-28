// Each repository owns its check policy. Invalid, missing, or empty policies
// deliberately produce no expected checks, which decide() treats as unknown.
export function parseRequiredChecks(raw) {
  if (typeof raw !== 'string') return [];
  let value;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return [];
  if (!value.every(name => typeof name === 'string' && name.length > 0 && name.length <= 200 && name.trim() === name)) return [];
  if (new Set(value).size !== value.length) return [];
  return value;
}
