import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';


// Add these styles to your CSS or Tailwind config
const sidebarStyles = {
  section: 'px-1 py-1',
  sectionTitle: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2',
  navItem: 'flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200',
  navItemActive: 'bg-blue-50 text-blue-700',
  navItemInactive: 'text-gray-700 hover:bg-gray-100',
  chevron: 'ml-auto h-4 w-4 transform transition-transform duration-200',
  chevronOpen: 'rotate-180',
  subItem: 'ml-6 text-sm',
};

const Sidebar = () => {
  const [openSections, setOpenSections] = useState({
    dashboard: true,
    agentManagement: true,
    candidateManagement: true,
    ticketManagement: true
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
      <nav className="mt-5 flex-1 px-2 space-y-1">
        {/* Dashboard */}
        <div className={sidebarStyles.section}>
          <div 
            className={sidebarStyles.sectionTitle}
            onClick={() => toggleSection('dashboard')}
          >
            <div className="flex items-center cursor-pointer">
              <span>Dashboard</span>
              <svg 
                className={`${sidebarStyles.chevron} ${openSections.dashboard ? sidebarStyles.chevronOpen : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {openSections.dashboard && (
            <div className="mt-1 space-y-1">
              <NavItem to="/" className={sidebarStyles.subItem}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
                Dashboard
              </NavItem>
            </div>
          )}
        </div>

        {/* Tickets Section */}
        <div className={sidebarStyles.section}>
          <div 
            className={sidebarStyles.sectionTitle}
            onClick={() => toggleSection('ticketManagement')}
          >
            <div className="flex items-center cursor-pointer">
              <span>Ticket Management</span>
              <svg 
                className={`${sidebarStyles.chevron} ${openSections.ticketManagement ? sidebarStyles.chevronOpen : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {openSections.ticketManagement && (
            <div className="mt-1 space-y-1">
              <NavItem to="/tickets" className={sidebarStyles.subItem}>
              <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 mr-2"
                >
                  <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1a2 2 0 0 0 0 4v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1a2 2 0 0 0 0-4V7z" />
              </svg>

                Tickets
              </NavItem>
            </div>
          )}
        </div>

        {/* Agent Management Section */}
        <div className={sidebarStyles.section}>
          <div 
            className={sidebarStyles.sectionTitle}
            onClick={() => toggleSection('agentManagement')}
          >
            <div className="flex items-center cursor-pointer">
              <span>Agent Management</span>
              <svg 
                className={`${sidebarStyles.chevron} ${openSections.agentManagement ? sidebarStyles.chevronOpen : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {openSections.agentManagement && (
            <div className="mt-1 space-y-1">
              <NavItem to="/agents" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Agents
              </NavItem>
              <NavItem to="/departments" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Departments
              </NavItem>
              <NavItem to="/categories" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Categories
              </NavItem>
            </div>
          )}
        </div>

        {/* Candidate Management Section */}
        <div className={sidebarStyles.section}>
          <div 
            className={sidebarStyles.sectionTitle}
            onClick={() => toggleSection('candidateManagement')}
          >
            <div className="flex items-center cursor-pointer">
              <span>Candidate Management</span>
              <svg 
                className={`${sidebarStyles.chevron} ${openSections.candidateManagement ? sidebarStyles.chevronOpen : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {openSections.candidateManagement && (
            <div className="mt-1 space-y-1">
              <NavItem to="/candidates" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Candidates
              </NavItem>
              <NavItem to="/universities" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
                Universities
              </NavItem>
              <NavItem to="/batches" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Batches
              </NavItem>
              <NavItem to="/templates" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10v10H7zM4 4h16v16H4zM8 12h8M12 8v8" />
                </svg>
                Templates
              </NavItem>
              <NavItem to="/programs" className={sidebarStyles.subItem}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Programs
              </NavItem>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

// Update NavItem component to handle active state and custom classes
const NavItem = ({ to, children, className = '' }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`${sidebarStyles.navItem} ${
        isActive ? sidebarStyles.navItemActive : sidebarStyles.navItemInactive
      } ${className}`}
    >
      {children}
    </Link>
  );
};

export default Sidebar;
