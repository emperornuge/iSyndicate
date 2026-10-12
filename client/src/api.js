/**
 * API client. In the iOS bundle, VITE_API_URL is baked in at build time
 * (see the GitHub Actions workflow, which reads it from the API_URL secret).
 * In local dev it defaults to '' and Vite proxies /api to localhost:3000.
 */
const API_URL = import.meta.env.VITE_API_URL || '';

async function req(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return data;
}

export const api = {
  login: (username) =>
    req('/api/login', { method: 'POST', body: JSON.stringify({ username }) }),
  getUser: (id) => req(`/api/user/${id}`),
  catalogs: () => req('/api/catalogs'),
  doMission: (userId, missionId) =>
    req('/api/mission/do', { method: 'POST', body: JSON.stringify({ userId, missionId }) }),
  buy: (userId, type, id) =>
    req('/api/shop/buy', { method: 'POST', body: JSON.stringify({ userId, type, id }) }),
  bank: (userId, action, amount) =>
    req('/api/bank', { method: 'POST', body: JSON.stringify({ userId, action, amount }) }),
  targets: (userId) => req(`/api/fight/targets/${userId}`),
  attack: (userId, targetId) =>
    req('/api/fight/attack', { method: 'POST', body: JSON.stringify({ userId, targetId }) }),
  invite: (userId, inviteCode) =>
    req('/api/mob/invite', { method: 'POST', body: JSON.stringify({ userId, inviteCode }) }),
  heal: (userId) =>
    req('/api/hospital/heal', { method: 'POST', body: JSON.stringify({ userId }) }),
};
