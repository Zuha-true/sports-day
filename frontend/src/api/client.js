import axios from 'axios';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Attach token from whichever key is present
client.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('studentToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear tokens and redirect to home
client.interceptors.response.use(
  res => res,
  err => {
    const hadToken = !!(localStorage.getItem('adminToken') || localStorage.getItem('studentToken'));
    if (err.response?.status === 401 && hadToken) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('studentToken');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default client;
