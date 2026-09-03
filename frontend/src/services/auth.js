import { API_URL } from '../config';
import jwtDecode from 'jwt-decode'; // Import jwt-decode library
import api from './api';

// Helper to handle API errors
const handleApiError = (error) => {
  console.error('API Error:', error);
  if (error.response) {
    throw new Error(error.response.data.message || 'Authentication failed');
  }
  throw new Error('Network error occurred');
};

// Token management
export const getToken = () => localStorage.getItem('token');
export const setToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

// Normalize user data to ensure consistent format
const normalizeUserData = (userData) => {
  if (!userData) return null;
  
  return {
    ...userData,
    role: typeof userData.role === 'string' 
      ? { name: userData.role } 
      : userData.role,
  };
};

// User management
export const setUser = (user) => {
  const normalizedUser = normalizeUserData(user);
  if (normalizedUser) {
    localStorage.setItem('user', JSON.stringify(normalizedUser));
  } else {
    localStorage.removeItem('user');
  }
};

export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? normalizeUserData(JSON.parse(user)) : null;
};

// Auth functions
export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw {
        response: {
          data: {
            detail: data.detail || 'Login failed'
          }
        }
      };
    }

    const normalizedUser = normalizeUserData(data.user);
    console.log("normalizedUser: ", normalizedUser);
    // Store both token and user data
    setToken(data.access_token);
    setUser(normalizedUser);
    
    return {
      token: data.access_token,
      user: normalizedUser
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Session expired');
    }

    const userData = await response.json();
    const normalizedUser = normalizeUserData(userData);
    setUser(normalizedUser);
    return normalizedUser;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
};

export const logout = () => {
  setToken(null);
  setUser(null);
};

export const isAuthenticated = () => {
  return !!getToken();
};

export const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const handleSSOToken = () => {
  const params = new URLSearchParams(window.location.search);
  const ssoData = params.get('sso_data');
  const redirect = params.get('redirect') || '/dashboard';

  if (ssoData) {
    try {
      // Decode the JWT containing auth data
      const authData = jwtDecode(ssoData);

      console.log("Auth Data: ", authData);
      
      if (!authData || !authData.access_token || !authData.user) {
        throw new Error('Invalid SSO data');
      }

      // Store the token
      localStorage.setItem('token', authData.access_token);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Check for ticket_id in the auth data for email auto-login
      if (authData.ticket_id) {
        console.log("Email auto-login with ticket ID:", authData.ticket_id);
        return `/tickets/${authData.ticket_id}`;
      }
      
      return redirect;
    } catch (error) {
      console.error('Error processing SSO data:', error);
      return '/login';
    }
  }
  
  return null;
};

export const handleEmailAutoLoginToken = () => {
  const params = new URLSearchParams(window.location.search);
  const emailAutoLoginToken = params.get('email_auto_login_token');
  
  if (emailAutoLoginToken) {
    try {
      // Decode the JWT containing auth data
      const authData = jwtDecode(emailAutoLoginToken);

      console.log("Auth Data: ", authData);
      
      if (!authData || !authData.access_token || !authData.user) {
        throw new Error('Invalid email auto-login token');
      }

      // Store the token
      localStorage.setItem('token', authData.access_token);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      return `/tickets/${authData.ticket_id}`;
    } catch (error) {
      console.error('Error processing email auto-login token:', error);
      return '/login';
    }
  }
  
  return null;
};

export const authService = {
  login,
  logout,
  getCurrentUser,
  requestPasswordReset,
  verifyResetToken,
  completePasswordReset
};

async function requestPasswordReset(email) {
  const response = await api.post(`${API_URL}/auth/password-reset/request`, { 
    email_address: email 
  });
  return response.data;
}

async function verifyResetToken(token) {
  const response = await api.post(`${API_URL}/auth/password-reset/verify`, { token: token });
  return response.data;
}

async function completePasswordReset(token, newPassword) {
  const response = await api.post(`${API_URL}/auth/password-reset/complete`, {
    token,
    new_password: newPassword
  });
  return response.data;
}