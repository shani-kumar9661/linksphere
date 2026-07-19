/**
 * Utility helper to determine the base URL for short link redirection.
 * In development mode (Vite running on port 5173), short links route directly to the backend on port 5000.
 * In production/behind the Nginx reverse proxy, short links route to the proxy host (domain + port if any).
 * 
 * @returns {string} The base URL for short links
 */
export const getShortBaseUrl = () => {
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return `${window.location.protocol}//${window.location.host}`;
};
