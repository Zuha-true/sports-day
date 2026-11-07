import client from './client';

export function getDecodedToken(key) {
  const token = localStorage.getItem(key);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch { return null; }
}

export function isAdmin()   { return getDecodedToken('adminToken')?.role === 'admin'; }
export function isStudent() { return getDecodedToken('studentToken')?.role === 'student'; }

export function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('studentToken');
  window.location.href = '/';
}

export const authApi = {
  signup: data => client.post('/auth/signup', data),
  // Unified login: backend returns role in response, caller stores correct token
  login: async data => {
    const res = await client.post('/auth/login', data);
    if (res.data.role === 'admin') {
      localStorage.setItem('adminToken', res.data.token);
    } else {
      localStorage.setItem('studentToken', res.data.token);
    }
    return res;
  },
};
