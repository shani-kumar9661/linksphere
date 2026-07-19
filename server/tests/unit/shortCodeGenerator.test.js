const generateShortCode = require('../../src/utils/shortCodeGenerator');

describe('shortCodeGenerator unit tests', () => {
  test('should return a string', () => {
    const code = generateShortCode();
    expect(typeof code).toBe('string');
  });

  test('should return a string of length 6 by default', () => {
    const code = generateShortCode();
    expect(code.length).toBe(6);
  });

  test('should return a string of requested length', () => {
    const code = generateShortCode(8);
    expect(code.length).toBe(8);
    const code10 = generateShortCode(10);
    expect(code10.length).toBe(10);
  });

  test('should contain only alphanumeric characters', () => {
    const code = generateShortCode(100);
    const base62Regex = /^[A-Za-z0-9]+$/;
    expect(base62Regex.test(code)).toBe(true);
  });

  test('should generate different codes on subsequent calls', () => {
    const code1 = generateShortCode();
    const code2 = generateShortCode();
    expect(code1).not.toBe(code2);
  });
});
