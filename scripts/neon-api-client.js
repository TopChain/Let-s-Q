const HOST_SESSION_KEY = 'letsq.neon.hostSession.v1';
const LEGACY_HOST_SESSION_KEY = 'letsq.supabase.hostSession.v1';

let cachedHost = null;

function settings() {
  return window.LetsQFirebaseConfig || window.LETS_Q_CONFIG || {};
}

function apiUrl() {
  const config = settings();
  if (config.apiBaseUrl) return config.apiBaseUrl;
  if (config.publicAppUrl) return new URL('/.netlify/functions/letsq-api', config.publicAppUrl).toString();
  throw new Error('The Let’s Q queue service is not configured.');
}

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function savedHost() {
  if (cachedHost?.token) return cachedHost;
  const current = readJson(HOST_SESSION_KEY, null);
  const legacy = readJson(LEGACY_HOST_SESSION_KEY, null);
  cachedHost = current?.token ? current : legacy?.token ? legacy : null;
  return cachedHost;
}

function saveHost(host) {
  cachedHost = host?.token ? host : null;
  if (cachedHost) writeJson(HOST_SESSION_KEY, cachedHost);
  else remove(HOST_SESSION_KEY);
}

function requestHeaders(hostToken) {
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (hostToken) headers.authorization = `Bearer ${hostToken}`;
  return headers;
}

export async function apiRequest(action, payload = {}, options = {}) {
  const host = options.host === true ? savedHost() : null;
  const response = await fetch(apiUrl(), {
    method: 'POST',
    headers: requestHeaders(host?.token),
    body: JSON.stringify({ action, payload })
  });

  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.error || `The queue service returned ${response.status}.`);
    error.status = response.status;
    error.code = body?.code || 'QUEUE_API_ERROR';
    throw error;
  }
  return body?.data ?? null;
}

export async function ensureHostSession() {
  const existing = savedHost();
  if (existing?.token && existing?.hostId) return existing;

  const data = await apiRequest('ensure-host');
  if (!data?.hostToken || !data?.hostId) throw new Error('Could not create this device’s private Host identity.');
  const created = { token: data.hostToken, hostId: data.hostId };
  saveHost(created);
  return created;
}

export function currentHostSession() {
  return savedHost();
}

export function clearHostSession() {
  cachedHost = null;
  remove(HOST_SESSION_KEY);
  remove(LEGACY_HOST_SESSION_KEY);
}

export function queueApiConfigured() {
  try { return Boolean(apiUrl()); } catch { return false; }
}
