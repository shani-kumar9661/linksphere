const { validateAlias } = require('../../src/utils/aliasValidator');

describe('aliasValidator unit tests', () => {
  test('should validate correct custom aliases', () => {
    const cases = ['my-link', 'valid_link', '12345', 'abc-123_xyz'];
    cases.forEach(alias => {
      const res = validateAlias(alias);
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe(alias.toLowerCase());
    });
  });

  test('should fail if custom alias is not a string', () => {
    expect(validateAlias(null).isValid).toBe(false);
    expect(validateAlias(1234).isValid).toBe(false);
    expect(validateAlias({}).isValid).toBe(false);
  });

  test('should fail if custom alias is too short or too long', () => {
    expect(validateAlias('ab').isValid).toBe(false);
    expect(validateAlias('a'.repeat(31)).isValid).toBe(false);
  });

  test('should fail if custom alias contains invalid characters', () => {
    const invalidCases = ['my link', 'my$link', 'my/link', 'my.link', 'my@link'];
    invalidCases.forEach(alias => {
      expect(validateAlias(alias).isValid).toBe(false);
    });
  });

  test('should fail if custom alias is a reserved word', () => {
    const reservedCases = ['admin', 'api', 'auth', 'health', 'login'];
    reservedCases.forEach(alias => {
      expect(validateAlias(alias).isValid).toBe(false);
      expect(validateAlias(alias).error).toContain('reserved word');
    });
  });
});
