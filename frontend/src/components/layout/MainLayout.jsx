import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const MainLayout = ({ children }) => {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const isAdmin = user?.role?.name === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#f5f6fa] transition-colors duration-200`}>
        <div className="flex items-center justify-center h-screen">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-blue-400' : 'border-indigo-600'}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#f8f9fe] text-gray-800 transition-colors duration-200`}>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        {isAdmin && (
          <>
            {/* hamburger button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="fixed left-4 top-20 z-50 p-2 rounded-md bg-indigo-400 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-30 top-16"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <aside className={`
              fixed left-0 top-16 bottom-0 w-64 
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} 
              border-r overflow-y-auto shadow-sm transition-all duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0 z-40' : '-translate-x-full lg:translate-x-0 lg:z-10'}
              ${!sidebarOpen && 'lg:hidden'}
`}>
              <Sidebar />
            </aside>
          </>
        )}
        <main className={`w-full transition-all duration-300 ${
          isAdmin && sidebarOpen ? 'lg:pl-64' : ''
        }`}>
          <div className="h-full p-0 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
