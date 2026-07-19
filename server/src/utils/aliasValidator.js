const RESERVED_WORDS = new Set([
  'api', 'v1', 'auth', 'login', 'register', 'logout', 'urls', 'health', 'test-error',
  'admin', 'administrator', 'user', 'users', 'dashboard', 'settings', 'profile', 'config',
  'setup', 'status', 'info', 'help', 'about', 'contact', 'terms', 'privacy', 'support',
  'faq', 'legal', 'jobs', 'careers', 'blog', 'news', 'feed', 'assets', 'static', 'public',
  'css', 'js', 'images', 'img', 'favicon', 'favicon.ico', 'robots', 'robots.txt', 'sitemap', 'sitemap.xml', 'manifest.json',
  'index', 'home', 'root', 'shorten', 'redirect', 'analytics', 'clicks', 'stats', 'link', 'links'
]);

/**
 * Validates a custom alias.
 * - Must be a string.
 * - Alphanumeric, dashes, underscores only.
 * - Between 3 and 30 characters.
 * - Cannot be a reserved word.
 * 
 * @param {string} alias - The custom alias input
 * @returns {object} { isValid: boolean, error?: string, normalized?: string }
 */
const validateAlias = (alias) => {
  if (!alias || typeof alias !== 'string') {
    return { isValid: false, error: 'Custom alias must be a string' };
  }

  const aliasTrimmed = alias.trim().toLowerCase();

  // Basic validation (alphanumeric, dashes, underscores, 3-30 chars)
  const aliasRegex = /^[a-z0-9-_]{3,30}$/;
  if (!aliasRegex.test(aliasTrimmed)) {
    return { 
      isValid: false, 
      error: 'Custom alias must be alphanumeric (dashes/underscores allowed) and between 3 and 30 characters' 
    };
  }

  // Reserved words check
  if (RESERVED_WORDS.has(aliasTrimmed)) {
    return {
      isValid: false,
      error: 'This custom alias is a reserved word and cannot be used'
    };
  }

  return { isValid: true, normalized: aliasTrimmed };
};

module.exports = { validateAlias, RESERVED_WORDS };
