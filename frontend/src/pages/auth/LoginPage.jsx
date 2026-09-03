import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { handleSSOToken, login as authLogin } from '../../services/auth';
import jwtDecode from 'jwt-decode';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: contextLogin, isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check for SSO errors first
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('error');
    const ssoStatus = params.get('status');
    const email = params.get('email');

    if (ssoStatus === 'error' && ssoError) {
      let errorMessage = '';
      let errorDescription = '';

      switch (ssoError) {
        case 'User not found':
          errorMessage = 'User not found';
          errorDescription = email 
            ? `The email address ${email} is not registered in the helpdesk system. Please contact your administrator for access.`
            : 'Your email is not registered in the helpdesk system. Please contact your administrator for access.';
          break;

        case 'Account deactivated':
          errorMessage = 'Account deactivated';
          errorDescription = 'Your account has been deactivated. Please contact your administrator for assistance.';
          break;

        case 'Invalid authentication token':
          errorMessage = 'Invalid authentication';
          errorDescription = 'Your authentication token is invalid or has expired. Please try logging in again from Moodle.';
          break;

        default:
          errorMessage = 'Login Failed';
          errorDescription = 'An error occurred while trying to log you in. Please try again or contact your administrator.';
      }

      setError({
        message: errorMessage,
        description: errorDescription
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check for SSO token
    const ssoData = params.get('sso_data');
    if (ssoData) {
      try {
        // Decode the JWT containing auth data
        const authData = jwtDecode(ssoData);
        if (authData && authData.access_token && authData.user) {
          // Store the token and user data
          localStorage.setItem('token', authData.access_token);
          localStorage.setItem('user', JSON.stringify(authData.user));
          
          // Clean up URL and redirect
          const redirect = params.get('redirect') || '/dashboard';
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate(redirect);
          return;
        }
      } catch (error) {
        console.error('Error processing SSO data:', error);
        setError({
          message: 'Login Failed',
          description: 'An error occurred while processing your login. Please try again.'
        });
      }
    }

    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { token, user } = await authLogin(formData.email, formData.password);
      contextLogin(user, token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const errorDetail = err.response?.data?.detail;
      
      if (typeof errorDetail === 'object') {
        setError({
          message: errorDetail.message,
          description: errorDetail.description
        });
      } else {
        setError({
          message: 'Login Failed',
          description: errorDetail || 'An unexpected error occurred. Please try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-purple-600 to-indigo-700'} flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-white">
          Sign in to your account
        </h2>
        <p className={`mt-2 text-center text-sm ${isDark ? 'text-gray-300' : 'text-purple-200'}`}>
          Welcome to <span className="font-bold">Ticksy by Futurense</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} py-8 px-4 shadow-xl rounded-lg sm:px-10 transition-colors duration-200`}>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className={`${isDark ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-400'} border-l-4 p-4 transition-colors duration-200`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className={`h-5 w-5 ${isDark ? 'text-red-500' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error.message}</p>
                    {error.description && (
                      <p className={`mt-2 text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error.description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 border ${isDark ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400' : 'border-gray-300 placeholder-gray-400'} rounded-md shadow-sm focus:outline-none ${isDark ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'} sm:text-sm transition-colors duration-200`}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 border ${isDark ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400' : 'border-gray-300 placeholder-gray-400'} rounded-md shadow-sm focus:outline-none ${isDark ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'} sm:text-sm transition-colors duration-200`}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className={`font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-purple-600 hover:text-purple-500'}`}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isDark 
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200`}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDark ? 'border-gray-700' : 'border-gray-300'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-2 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
                  Need help?
                </span>
              </div>
            </div>

            <div className="mt-6 text-center text-sm">
              <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Contact your administrator</span>
              {' '}
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
