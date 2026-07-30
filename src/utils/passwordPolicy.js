export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};':\",.<>/?\\|~`";

const symbolPattern = new RegExp(`[${PASSWORD_SYMBOLS.replace(/[\\\]\-^]/g, '\\$&')}]`);

export function evaluatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const requirements = {
    length: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: symbolPattern.test(value),
  };
  return { value, requirements, valid: Object.values(requirements).every(Boolean) };
}

export function isStrongPassword(password) {
  return evaluatePassword(password).valid;
}
