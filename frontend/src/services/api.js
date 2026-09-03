// src/services/api.js
import axios from 'axios';
import { API_URL } from '../config';
import { getToken, logout } from './auth';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  maxRedirects: 0, // Prevent automatic redirects
  validateStatus: function (status) {
    return status >= 200 && status < 300; // Only treat 2xx as success
  }
});

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log the request details
    // if (config.url.includes('/tickets/')) {
    //   console.log('📤 API Request:', {
    //     url: config.url,
    //     method: config.method,
    //     params: config.params,
    //     fullUrl: config.baseURL + config.url + (config.params ? '?' + new URLSearchParams(config.params).toString() : '')
    //   });
    // }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle redirects manually
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
