import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleNavClick = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 left-0 right-0 bg-[radial-gradient(457.92%_145.97%_at_49.77%_145.97%,_#3C1296_0%,_#1D1336_100%)] shadow-xl z-50 backdrop-blur-sm">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center group cursor-pointer">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <div className="flex flex-col">
                  <span className='text-white font-bold text-xl sm:text-2xl group-hover:text-blue-200 transition-all duration-300'>
                    Ticksy
                  </span> 
                  <span className="text-gray-300 text-[12px] group-hover:text-blue-100 transition-all duration-300 -mt-1">
                    By Futurense
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1 flex-1 max-w-2xl mx-8">
            
          </div>

          {/* Right Section: New Ticket + User */}
          <div className="hidden md:flex md:items-center md:space-x-3">

            <Link
              to="/dashboard"
              className={`
                ${
                  isActive('/dashboard')
                    ? 'bg-white/20 text-white'
                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                } inline-flex items-center px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link
              to="/tickets"
              className={`
                ${
                  isActive('/tickets')
                    ? 'bg-white/20 text-white'
                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                } inline-flex items-center px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tickets
            </Link>
            {/* Prominent New Ticket Button */}
            <button
              onClick={() => navigate('/tickets/new')}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/30 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Ticket
            </button>
            
            {/* User Info - Desktop */}
            <div className="flex items-center space-x-2 pl-3 border-l border-white/20">
              <Link
                
                className={`
                  ${isActive('/profile') ? 'bg-white/20' : 'hover:bg-white/10'}
                  flex items-center space-x-2 text-white px-2.5 py-1.5 rounded-lg transition-all duration-200
                `}
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="truncate max-w-[120px] hidden lg:inline text-sm font-medium" title={user?.name}>
                  {user?.name?.length > 12 ? `${user.name.substring(0, 12)}...` : user?.name}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-600/80 transition-all duration-200 group"
                title="Logout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-12 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden xl:inline text-sm">Logout</span>
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!mobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="px-3 pt-3 pb-4 space-y-2 bg-gradient-to-b from-purple-900/95 to-indigo-900/95 backdrop-blur-lg">
          {/* User Info - Mobile */}
          <div className="px-3 py-3 border-b border-white/20 mb-3">
            <div className="flex items-center space-x-3 text-white">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold">{user?.name}</div>
                <div className="text-xs text-gray-300 mt-0.5">{user?.email}</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleNavClick('/dashboard')}
            className={`
              ${
                isActive('/dashboard')
                  ? 'bg-white/20 text-white border-l-4 border-blue-400'
                  : 'text-gray-200 hover:bg-white/10 hover:text-white border-l-4 border-transparent'
              } flex items-center w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </button>
          <button
            onClick={() => handleNavClick('/tickets')}
            className={`
              ${
                isActive('/tickets')
                  ? 'bg-white/20 text-white border-l-4 border-blue-400'
                  : 'text-gray-200 hover:bg-white/10 hover:text-white border-l-4 border-transparent'
              } flex items-center w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Tickets
          </button>
          
          {/* Prominent New Ticket Button - Mobile */}
          <button
            onClick={() => handleNavClick('/tickets/new')}
            className="flex items-center justify-center w-full px-4 py-3 rounded-lg text-base font-semibold bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 mt-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center w-full text-left px-4 py-3 rounded-lg text-base font-medium text-white hover:bg-red-600/80 transition-all duration-200 border-t border-white/20 mt-3 pt-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;