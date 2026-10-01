const APP_CONFIG = Object.freeze({
  APPS_SCRIPT_URL: '/api', // Proxy no servidor — URL real fica no .env do Render
  SESSION_KEY:     'filhotes_admin_session',
  SESSION_TTL_MS:  30 * 60 * 1000,
  REQUEST_TIMEOUT: 30000,
});
