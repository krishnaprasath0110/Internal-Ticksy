import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../../utils/roles';
import { useTheme } from '../../context/ThemeContext';
import { userService } from '../../services/user';

const statusColors = {
  'Open': {
    light: 'bg-green-100 text-green-800',
    dark: 'bg-green-900 text-green-300'
  },
  'In Progress': {
    light: 'bg-amber-100 text-amber-800',
    dark: 'bg-amber-900 text-amber-300'
  },
  'Closed': {
    light: 'bg-gray-100 text-gray-800',
    dark: 'bg-gray-700 text-gray-300'
  },
  'Not Applicable': {
    light: 'bg-gray-200 text-gray-800',
    dark: 'bg-gray-700 text-gray-300'
  },
  'Delayed': {
    light: 'bg-red-100 text-red-800',
    dark: 'bg-red-900 text-red-300'
  }
};

const TicketCard = ({ ticket, onClick }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  return (
    <tr 
      onClick={onClick}
      className={`hover:${isDark ? 'bg-gray-700' : 'bg-gray-50'} cursor-pointer transition-colors duration-150 ease-in-out border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
    >
      {/* Ticket Info (ID, Title, Creator) */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className={`h-8 w-8 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'} flex items-center justify-center`}>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                {ticket.created_by?.name?.[0] || '?'}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center">
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>#{ticket.id}</span>
              <span className={`ml-2 text-sm text-gray-500`}>{ticket.created_by?.name}</span>
            </div>
            <div className={`text-xs text-gray-500 mt-0.5`}>
              {ticket.created_by?.email}
            </div>
            <h3 className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'} mt-1 truncate max-w-xs`}>
              {ticket.title}
            </h3>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? statusColors[ticket.status.description].dark : statusColors[ticket.status.description].light}`}>
            {ticket.status.description}
          </span>
          {ticket.is_delayed && user.role.name !== ROLES.CANDIDATE && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? statusColors['Delayed'].dark : statusColors['Delayed'].light}`}>
              Delayed
            </span>
          )}
        </div>
      </td>

      {/* Category */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center space-x-1.5 ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-50 text-gray-700'} px-2.5 py-0.5 rounded-full text-xs font-medium`}>
          <span>{ticket.category?.name || 'Unknown'}</span>
        </div>
      </td>

      {/* Priority - Internal Users Only */}
      {user.role.name !== ROLES.CANDIDATE && (
        <td className="px-6 py-4 whitespace-nowrap">
          {ticket.priority ? (
            <span 
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                ticket.priority === 'high' 
                  ? 'bg-red-100 text-red-800'
                  : ticket.priority === 'medium'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {ticket.priority}
            </span>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </td>
      )}

      {/* Assigned To */}
      {user.role.name !== ROLES.CANDIDATE && (
      <td className="px-6 py-4">
        <div className="flex items-center gap-1 flex-wrap">
          {ticket?.assigned_to ? (
            <div
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
              title={ticket.assigned_to.email}
            >
              {ticket.assigned_to.name} (Assigned)
            </div>
          ) : (
            ticket?.category_agents && ticket.category_agents.length > 0 ? (
              ticket.category_agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-500`}
                  title={agent.email}
                >
                  {agent.name}
                </div>
              ))
            ) : (
              <span className="text-sm text-gray-500">No agents</span>
            )
          )}
        </div>
      </td>
      )}

      {/* Batch */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {ticket.created_by?.batch_info?.batch_name || 'N/A'}
        </span>
      </td>

      {/* Program */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {ticket.created_by?.batch_info?.program_name || 'N/A'}
        </span>
      </td>

      {/* University */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {ticket.created_by?.batch_info?.university_name || 'N/A'}
        </span>
      </td>


      {/* Created At */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {ticket.created_at ? new Date(ticket.created_at + 'Z').toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
          }) : 'N/A'}
        </span>
      </td>
    </tr>
  );
};

const TicketList = ({ 
  tickets = [], 
  loading = false,
  resolutionTimeFilter = '',
  priorityFilterValue = '',
  agentIdFilter = '',
  syncedCategoryFilter = '',
  syncedBatchFilter = '',
  syncedProgramFilter = '',
  syncedUniversityFilter = '',
  statusFilterValue = '',
  delayedFilterValue = '',
  searchValue = '',
  onSearchChange = null,
  onTicketListFilterChange = null,
  onResolutionFilterChange = null,
  onPriorityFilterChange = null,
  onStatusFilterChange = null,
  onDelayedFilterChange = null,
  onClearAllFilters = null,
  serverPagination = null
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    assigned_to: '',
    created_by: '',
    batch: '',
    program: '',
    university: '',
    date_range: 'all',
    custom_start_date: '',
    custom_end_date: ''
  });
  const [searchQuery, setSearchQuery] = useState(searchValue || '');
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);
  const [currentPage, setCurrentPage] = useState(serverPagination ? serverPagination.currentPage : 1);
  const [localResolutionFilter, setLocalResolutionFilter] = useState(resolutionTimeFilter);
  const [localPriorityFilter, setLocalPriorityFilter] = useState(priorityFilterValue);
  const [localAgentFilter, setLocalAgentFilter] = useState(agentIdFilter);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilterValue);
  const [localDelayedFilter, setLocalDelayedFilter] = useState(delayedFilterValue);
  const ticketsPerPage = serverPagination ? serverPagination.pageSize : 20;

  const [directoryAgents, setDirectoryAgents] = useState([]);

  // Load full agent list for filter labels and dropdown (current page alone is not enough)
  useEffect(() => {
    if (!serverPagination) return;
    if (!user?.role?.name) return;
    if (user.role.name === ROLES.AGENT || user.role.name === ROLES.CANDIDATE) return;
    let cancelled = false;
    userService
      .getUsers({ role: 'agent' })
      .then((list) => {
        if (!cancelled) setDirectoryAgents(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setDirectoryAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [serverPagination, user.role.name]);

  // Keep dropdowns and chips aligned with server-side filter state (replaceState does not update React Router)
  useEffect(() => {
    if (!serverPagination) return;
    setFilters((prev) => ({
      ...prev,
      category: syncedCategoryFilter || '',
      batch: syncedBatchFilter || '',
      program: syncedProgramFilter || '',
      university: syncedUniversityFilter || '',
      assigned_to: agentIdFilter || '',
    }));
  }, [
    serverPagination,
    syncedCategoryFilter,
    syncedBatchFilter,
    syncedProgramFilter,
    syncedUniversityFilter,
    agentIdFilter,
  ]);

  const mergedAgentOptions = useMemo(() => {
    const map = new Map();
    directoryAgents.forEach((a) => {
      if (a?.id != null) map.set(Number(a.id), { id: Number(a.id), name: a.name, email: a.email });
    });
    tickets.forEach((t) => {
      (t.category_agents || []).forEach((a) => {
        if (a?.id != null) map.set(Number(a.id), { id: Number(a.id), name: a.name, email: a.email });
      });
      if (t.assigned_to?.id != null) {
        const a = t.assigned_to;
        map.set(Number(a.id), { id: Number(a.id), name: a.name, email: a.email });
      }
    });
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [directoryAgents, tickets]);

  const resolveAgentName = useCallback(
    (rawId) => {
      if (rawId === '' || rawId == null) return '';
      const idNum = parseInt(String(rawId), 10);
      if (Number.isNaN(idNum)) return '';
      const fromMerged = mergedAgentOptions.find((a) => a.id === idNum);
      if (fromMerged?.name) return fromMerged.name;
      const fromAssigned = tickets.find((t) => t.assigned_to?.id === idNum)?.assigned_to?.name;
      if (fromAssigned) return fromAssigned;
      const fromCat = tickets.flatMap((t) => t.category_agents || []).find((a) => a.id === idNum)?.name;
      if (fromCat) return fromCat;
      return `Agent #${idNum}`;
    },
    [mergedAgentOptions, tickets]
  );

  // Sync external filter props to local state
  useEffect(() => {
    setLocalResolutionFilter(resolutionTimeFilter);
    setLocalPriorityFilter(priorityFilterValue);
    setLocalAgentFilter(agentIdFilter);
    setLocalStatusFilter(statusFilterValue);
    setLocalDelayedFilter(delayedFilterValue);
    if (searchValue !== undefined && searchValue !== searchQuery) {
      setSearchQuery(searchValue);
    }
  }, [resolutionTimeFilter, priorityFilterValue, agentIdFilter, statusFilterValue, delayedFilterValue, searchValue]);

  // Handle resolution filter change and update URL
  const handleResolutionFilterChange = (value) => {
    setLocalResolutionFilter(value);
    if (onResolutionFilterChange) {
      onResolutionFilterChange(value);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('resolution_time', value);
        params.delete('ageing');
      } else {
        params.delete('resolution_time');
        params.delete('ageing');
      }
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  // Handle priority filter change and update URL
  const handlePriorityFilterChange = (value) => {
    setLocalPriorityFilter(value);
    if (onPriorityFilterChange) {
      onPriorityFilterChange(value);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('priority', value);
      } else {
        params.delete('priority');
      }
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  // Handle status filter change and update URL
  const handleStatusFilterChange = (value) => {
    setLocalStatusFilter(value);
    if (onStatusFilterChange) {
      onStatusFilterChange(value);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('status', value);
      } else {
        params.delete('status');
      }
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  // Handle delayed filter change and update URL
  const handleDelayedFilterChange = (value) => {
    setLocalDelayedFilter(value);
    if (onDelayedFilterChange) {
      onDelayedFilterChange(value);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('delayed', value);
      } else {
        params.delete('delayed');
      }
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  const uniqueCategories = [...new Set([
    ...tickets.map(t => t.category?.id).filter(id => id),
    ...tickets.map(t => t.category?.id).filter(id => id)
  ].filter(Boolean))];

  const uniqueCreatedBy = [...new Set([
    ...tickets.map(t => t.created_by?.id).filter(id => id),
    ...tickets.map(t => t.created_by?.id).filter(id => id)
  ].filter(Boolean))];

  const uniqueBatches = [...new Set(
    tickets
      .map(t => t.created_by?.batch_info?.batch_id)
      .filter(Boolean)
  )];

  const uniquePrograms = [...new Set(
    tickets
      .map(t => t.created_by?.batch_info?.program_id)
      .filter(Boolean)
  )];

  const uniqueUniversities = [...new Set(
    tickets
      .map(t => t.created_by?.batch_info?.university_id)
      .filter(Boolean)
  )];

  const dateRangeOptions = [
    { label: 'Select Date', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Custom Range', value: 'custom' }
  ];

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Update URL parameters (canonical *_id keys match TicketsPage URL restore)
    const params = new URLSearchParams(window.location.search);
    const urlFieldMap = {
      assigned_to: 'agent_id',
      batch: 'batch_id',
      program: 'program_id',
      university: 'university_id',
      category: 'category_id',
    };
    const urlField = urlFieldMap[field] || field;
    const legacyKeys = {
      batch_id: ['batch'],
      program_id: ['program'],
      university_id: ['university'],
      category_id: ['category'],
    };
    if (value && value !== 'all') {
      params.set(urlField, value);
      (legacyKeys[urlField] || []).forEach((k) => params.delete(k));
    } else {
      params.delete(urlField);
      (legacyKeys[urlField] || []).forEach((k) => params.delete(k));
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

    // If server-side filtering is available, notify parent
    if (onTicketListFilterChange && serverPagination) {
      const filterMap = {
        category: 'category',
        batch: 'batch',
        program: 'program',
        university: 'university',
        assigned_to: 'agent_id',
      };
      if (filterMap[field]) {
        onTicketListFilterChange({ [filterMap[field]]: value || '' });
      }
      // Handle date range
      if (field === 'date_range') {
        if (value === 'today') {
          const today = new Date().toISOString().split('T')[0];
          onTicketListFilterChange({ start_date: today, end_date: today });
        } else if (value === 'week') {
          const today = new Date();
          const weekAgo = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
          onTicketListFilterChange({ start_date: weekAgo, end_date: new Date().toISOString().split('T')[0] });
        } else if (value === 'month') {
          const today = new Date();
          const monthAgo = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
          onTicketListFilterChange({ start_date: monthAgo, end_date: new Date().toISOString().split('T')[0] });
        } else if (value === 'all') {
          onTicketListFilterChange({ start_date: '', end_date: '' });
        }
      }
      if (field === 'custom_start_date') {
        onTicketListFilterChange({ start_date: value || '' });
      }
      if (field === 'custom_end_date') {
        onTicketListFilterChange({ end_date: value || '' });
      }
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // If server-side search is available, debounce and call parent
    if (onSearchChange) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      const timer = setTimeout(() => {
        onSearchChange(value);
      }, 400);
      setSearchDebounceTimer(timer);
    } else {
      // Fallback: update URL parameters for client-side
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  // When server pagination is active, skip client-side filtering (server handles it)
  const filteredTickets = serverPagination ? tickets : tickets.filter(ticket => {
    // Search filter - search across multiple fields
    const matchesSearch = !searchQuery || 
      ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id?.toString().includes(searchQuery) ||
      ticket.created_by?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.created_by?.batch_info?.batch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.created_by?.batch_info?.program_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.created_by?.batch_info?.university_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !filters.status || 
      (ticket.status?.name === filters.status || 
       ticket.status.name === filters.status);
    const matchesCategory = !filters.category || 
      (ticket.category?.id === parseInt(filters.category));
    const matchesAssignedTo = !filters.assigned_to || 
      (ticket.assigned_to && ticket.assigned_to.id === parseInt(filters.assigned_to)) ||
      (ticket.category_agents && 
       ticket.category_agents.some(agent => agent.id === parseInt(filters.assigned_to)));
    const matchesCreatedBy = !filters.created_by || 
      (ticket.created_by?.id === parseInt(filters.created_by));
    
    const matchesBatch = !filters.batch || 
      (ticket.created_by?.batch_info?.batch_id === parseInt(filters.batch));
    
    const matchesProgram = !filters.program || 
      (ticket.created_by?.batch_info?.program_id === parseInt(filters.program));
    
    const matchesUniversity = !filters.university || 
      (ticket.created_by?.batch_info?.university_id === parseInt(filters.university));

    // Date filtering logic
    let matchesDate = true;
    if (filters.date_range === 'today') {
      const ticketDate = new Date(ticket.created_at);
      const today = new Date();
      matchesDate = ticketDate.toDateString() === today.toDateString();
    } else if (filters.date_range === 'week') {
      const ticketDate = new Date(ticket.created_at);
      const today = new Date();
      const weekAgo = new Date(today.setDate(today.getDate() - 7));
      matchesDate = ticketDate >= weekAgo;
    } else if (filters.date_range === 'month') {
      const ticketDate = new Date(ticket.created_at);
      const today = new Date();
      const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
      matchesDate = ticketDate >= monthAgo;
    } else if (filters.date_range === 'custom') {
      if (filters.custom_start_date || filters.custom_end_date) {
        const ticketDate = new Date(ticket.created_at);
        if (filters.custom_start_date && filters.custom_end_date) {
          const startDate = new Date(filters.custom_start_date);
          const endDate = new Date(filters.custom_end_date);
          endDate.setHours(23, 59, 59, 999);
          matchesDate = ticketDate >= startDate && ticketDate <= endDate;
        } else if (filters.custom_start_date) {
          const startDate = new Date(filters.custom_start_date);
          matchesDate = ticketDate >= startDate;
        } else if (filters.custom_end_date) {
          const endDate = new Date(filters.custom_end_date);
          endDate.setHours(23, 59, 59, 999);
          matchesDate = ticketDate <= endDate;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesAssignedTo && 
           matchesCreatedBy && matchesBatch && matchesProgram && matchesUniversity && matchesDate;
  });

  // Pagination logic - use server pagination when available
  const useServerPaging = !!serverPagination;
  const totalPages = useServerPaging ? serverPagination.totalPages : Math.ceil(filteredTickets.length / ticketsPerPage);
  const effectivePage = useServerPaging ? serverPagination.currentPage : currentPage;
  const indexOfLastTicket = effectivePage * ticketsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
  const currentTickets = useServerPaging ? filteredTickets : filteredTickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const displayTotal = useServerPaging ? serverPagination.totalTickets : filteredTickets.length;

  // Change page
  const paginate = (pageNumber) => {
    if (useServerPaging) {
      serverPagination.onPageChange(pageNumber);
    } else {
      setCurrentPage(pageNumber);
    }
  };
  const nextPage = () => {
    const next = Math.min(effectivePage + 1, totalPages);
    if (useServerPaging) {
      serverPagination.onPageChange(next);
    } else {
      setCurrentPage(next);
    }
  };
  const prevPage = () => {
    const prev = Math.max(effectivePage - 1, 1);
    if (useServerPaging) {
      serverPagination.onPageChange(prev);
    } else {
      setCurrentPage(prev);
    }
  };

  // Reset to first page when filters change (client-side only)
  useEffect(() => {
    if (!useServerPaging) {
      setCurrentPage(1);
    }
  }, [searchQuery, filters, useServerPaging]);

  return (
    <div className="mt-4">
      {/* Filters */}
      <div className={`bg-${isDark ? 'gray-800' : 'white'} shadow-sm rounded-lg border border-${isDark ? 'gray-700' : 'gray-100'} mb-4`}>
        <div className="p-6">
          {/* Filter Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Filters</h3>
            </div>
            {(searchQuery || filters.status || filters.category || filters.assigned_to || filters.created_by || filters.batch || filters.program || filters.university || filters.date_range !== 'all' || localResolutionFilter || localPriorityFilter || localStatusFilter || localDelayedFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ status: '', department: '', category: '', assigned_to: '', created_by: '', batch: '', program: '', university: '', date_range: 'all', custom_start_date: '', custom_end_date: '' });
                  handleStatusFilterChange('');
                  handleDelayedFilterChange('');
                  handleResolutionFilterChange('');
                  handlePriorityFilterChange('');
                  // Notify parent of search/filter reset
                  if (onSearchChange) onSearchChange('');
                  if (onClearAllFilters) onClearAllFilters();
                  // Clear all URL parameters
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className={`text-sm ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-200`}
              >
                Clear All
              </button>
            )}
          </div>

          {/* First Row - Main Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            {/* Search Filter */}
            <div className="md:col-span-2">
              <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Search</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search tickets, users..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} pl-10 pr-10 py-2 block w-full rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'} placeholder-${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (onSearchChange) onSearchChange('');
                      const params = new URLSearchParams(window.location.search);
                      params.delete('search');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-400'} hover:${isDark ? 'text-gray-200' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Status</label>
              <select
                value={localStatusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="closed">Closed</option>
                <option value="not-applicable">Not Applicable</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(id => (
                  <option key={id} value={id}>
                    {tickets.find(t => t.category?.id === id)?.category?.name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To Filter */}
            {user.role.name !== ROLES.AGENT && user.role.name !== ROLES.CANDIDATE && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Agent</label>
                <select
                  value={filters.assigned_to}
                  onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Agents</option>
                  {mergedAgentOptions.length > 0 ? (
                    mergedAgentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id} title={agent.email}>
                        {agent.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No agents loaded</option>
                  )}
                </select>
              </div>
            )}

            {/* Priority Filter */}
            {(user.role.name === ROLES.AGENT || user.role.name === ROLES.DEPARTMENT_SUPERVISOR || user.role.name === ROLES.DEPARTMENT_MANAGER || user.role.name === ROLES.ADMIN) && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Priority</label>
                <select
                  value={localPriorityFilter}
                  onChange={(e) => handlePriorityFilterChange(e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            )}
          {/* </div> */}

          {/* Second Row - Additional Filters */}
          {/* <div className="grid grid-cols-1 md:grid-cols-6 gap-4"> */}

            {/* Batch Filter */}
            {user.role.name !== ROLES.CANDIDATE && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Batch</label>
                <select
                  value={filters.batch}
                  onChange={(e) => handleFilterChange('batch', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Batches</option>
                  {uniqueBatches.map(id => (
                    <option key={id} value={id}>
                      {tickets.find(t => t.created_by?.batch_info?.batch_id === id)?.created_by?.batch_info?.batch_name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Program Filter */}
            {user.role.name !== ROLES.CANDIDATE && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Program</label>
                <select
                  value={filters.program}
                  onChange={(e) => handleFilterChange('program', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Programs</option>
                  {uniquePrograms.map(id => (
                    <option key={id} value={id}>
                      {tickets.find(t => t.created_by?.batch_info?.program_id === id)?.created_by?.batch_info?.program_name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* University Filter */}
            {user.role.name !== ROLES.CANDIDATE && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>University</label>
                <select
                  value={filters.university}
                  onChange={(e) => handleFilterChange('university', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Universities</option>
                  {uniqueUniversities.map(id => (
                    <option key={id} value={id}>
                      {tickets.find(t => t.created_by?.batch_info?.university_id === id)?.created_by?.batch_info?.university_name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Delayed Filter - Checkbox */}
            {user.role.name !== ROLES.CANDIDATE && (
              <div className="flex items-center ps-4 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localDelayedFilter === 'true'}
                    onChange={(e) => handleDelayedFilterChange(e.target.checked ? 'true' : '')}
                    className="w-4 h-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft"
                  />
                  <span className={`ml-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Show Delayed Tickets
                  </span>
                </label>
              </div>
            )}

            {/* Resolution Time Filter */}
            {(user.role.name === ROLES.DEPARTMENT_SUPERVISOR || user.role.name === ROLES.DEPARTMENT_MANAGER || user.role.name === ROLES.ADMIN) && (
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Resolution Time</label>
                <select
                  value={localResolutionFilter}
                  onChange={(e) => handleResolutionFilterChange(e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                >
                  <option value="">All Resolution Times</option>
                  <option value="8h">Within 8 Hours</option>
                  <option value="24h">Within 24 Hours</option>
                  <option value="48h">Within 48 Hours</option>
                  <option value="beyond_48h">Beyond 48 Hours</option>
                </select>
              </div>
            )}

            {/* Date Range Filter */}
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Date Range</label>
              <select
                value={filters.date_range}
                onChange={(e) => handleFilterChange('date_range', e.target.value)}
                className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            
          </div>

          {/* Custom Date Range Inputs */}
          {filters.date_range === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>Start Date</label>
                <input
                  type="date"
                  value={filters.custom_start_date}
                  onChange={(e) => handleFilterChange('custom_start_date', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'} mb-1`}>End Date</label>
                <input
                  type="date"
                  value={filters.custom_end_date}
                  onChange={(e) => handleFilterChange('custom_end_date', e.target.value)}
                  className={`bg-${isDark ? 'gray-700' : 'gray-50'} block w-full pl-3 pr-8 py-2 rounded-md border-${isDark ? 'gray-600' : 'gray-300'} shadow-sm focus:border-${isDark ? 'indigo-500' : 'indigo-500'} focus:ring-1 focus:ring-${isDark ? 'indigo-500' : 'indigo-500'} text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters - Always visible when filters are applied */}
      {(searchQuery || filters.status || filters.category || filters.assigned_to || filters.created_by || filters.batch || filters.program || filters.university || filters.date_range !== 'all' || localResolutionFilter || localPriorityFilter || localStatusFilter || localDelayedFilter) && (
        <div className={`bg-${isDark ? 'gray-800' : 'white'} shadow-sm rounded-lg border border-${isDark ? 'gray-700' : 'gray-100'} mb-4 p-4`}>
          <div className="flex flex-wrap gap-2 mb-3">
              {searchQuery && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.category && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Category: {tickets.find(t => t.category?.id === parseInt(filters.category))?.category?.name || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('category', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.assigned_to && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Agent: {resolveAgentName(filters.assigned_to)}
                  <button
                    onClick={() => handleFilterChange('assigned_to', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.created_by && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Created by: {tickets.find(t => t.created_by?.id === parseInt(filters.created_by))?.created_by?.name || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('created_by', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.batch && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Batch: {tickets.find(t => t.created_by?.batch_info?.batch_id === parseInt(filters.batch))?.created_by?.batch_info?.batch_name || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('batch', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.program && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Program: {tickets.find(t => t.created_by?.batch_info?.program_id === parseInt(filters.program))?.created_by?.batch_info?.program_name || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('program', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.university && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  University: {tickets.find(t => t.created_by?.batch_info?.university_id === parseInt(filters.university))?.created_by?.batch_info?.university_name || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('university', '')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.date_range !== 'all' && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Date: {dateRangeOptions.find(o => o.value === filters.date_range)?.label || 'Unknown'}
                  <button
                    onClick={() => handleFilterChange('date_range', 'all')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {(filters.custom_start_date || filters.custom_end_date) && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Custom Date Range: {filters.custom_start_date} - {filters.custom_end_date}
                  <button
                    onClick={() => {
                      handleFilterChange('custom_start_date', '');
                      handleFilterChange('custom_end_date', '');
                    }}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {localResolutionFilter && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Resolution Time: {localResolutionFilter}
                  <button
                    onClick={() => handleResolutionFilterChange('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {localPriorityFilter && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Priority: {localPriorityFilter}
                  <button
                    onClick={() => handlePriorityFilterChange('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {localStatusFilter && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Status: {localStatusFilter}
                  <button
                    onClick={() => handleStatusFilterChange('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {localDelayedFilter && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  Delayed Tickets
                  <button
                    onClick={() => handleDelayedFilterChange('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}
              {localResolutionFilter && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-indigo-100 text-indigo-800'}`}>
                  {localStatusFilter === 'open' ? 'FRT' : 'Resolution Time'}: {
                    localResolutionFilter === '8h' ? '≤ 8 hours' :
                    localResolutionFilter === '24h' ? '8-24 hours' :
                    localResolutionFilter === '48h' ? '24-48 hours' :
                    localResolutionFilter === 'beyond_48h' ? '> 48 hours' :
                    localResolutionFilter
                  }
                  <button
                    onClick={() => handleResolutionFilterChange('')}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-600 hover:bg-gray-200 focus:outline-none"
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              )}

              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ status: '', category: '', assigned_to: '', created_by: '', batch: '', program: '', university: '', date_range: 'all', custom_start_date: '', custom_end_date: '' });
                  handleResolutionFilterChange('');
                  handlePriorityFilterChange('');
                  handleStatusFilterChange('');
                  handleDelayedFilterChange('');
                  // Clear all URL parameters
                  window.history.replaceState({}, '', window.location.pathname);
                  if (onClearAllFilters) {
                    onClearAllFilters();
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDark ? 'bg-red-900 text-red-300 hover:bg-red-800' : 'bg-red-100 text-red-800 hover:bg-red-200'} transition-colors`}
              >
                Clear All Filters
              </button>
              </div>
              
        </div>
      )}

      {/* Total Tickets Count */}
      <div className={`bg-${isDark ? 'gray-800' : 'white'} shadow-sm rounded-lg border border-${isDark ? 'gray-700' : 'gray-100'} mb-4 p-3`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Total Tickets: <span className="text-indigo-600 dark:text-indigo-400">{displayTotal}</span>
          </h3>
          {useServerPaging && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Page {effectivePage} of {totalPages}
            </span>
          )}
          {!useServerPaging && (searchQuery || filters.status || filters.category || filters.assigned_to || filters.created_by || filters.batch || filters.program || filters.university || filters.date_range !== 'all' || localResolutionFilter || localPriorityFilter || localStatusFilter || localDelayedFilter) && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filteredTickets.length} of {tickets.length} tickets
            </span>
          )}
        </div>
      </div>

      {/* Tickets */}
      <div className={`bg-${isDark ? 'gray-800' : 'white'} shadow-sm rounded-lg border border-${isDark ? 'gray-700' : 'gray-100'} overflow-x-auto`}>
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>No tickets found</h3>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchQuery || Object.values(filters).some(f => f && f !== 'all') 
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating a new ticket'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span>Ticket</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Status</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>Category</span>
                  </div>
                </th>

                {user.role.name !== ROLES.CANDIDATE && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Priority</span>
                  </div>
                </th>
                )}

                {user.role.name !== ROLES.CANDIDATE && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Assigned To</span>
                  </div>
                </th>
                )}
                
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Batch</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Program</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>University</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Created At</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTickets.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => navigate(`/tickets/${ticket.id}${window.location.search}`)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(useServerPaging ? totalPages > 1 : filteredTickets.length > ticketsPerPage) && (
        <div className={`px-6 py-4 border-t border-${isDark ? 'gray-700' : 'gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{indexOfFirstTicket + 1}</span> to{" "}
              <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                {Math.min(indexOfLastTicket, displayTotal)}
              </span>{" "}
              of <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{displayTotal}</span> tickets
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={prevPage}
                disabled={effectivePage === 1}
                className={`relative inline-flex items-center px-4 py-2 border border-${isDark ? 'gray-600' : 'gray-300'} text-sm font-medium rounded-md ${
                  effectivePage === 1
                    ? `bg-${isDark ? 'gray-700' : 'gray-100'} text-${isDark ? 'gray-400' : 'gray-700'} cursor-not-allowed`
                    : `bg-${isDark ? 'gray-800' : 'white'} text-${isDark ? 'gray-200' : 'gray-700'} hover:bg-${isDark ? 'gray-700' : 'gray-50'}`
                }`}
              >
                Previous
              </button>
              
              <div className="hidden md:flex">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (effectivePage <= 3) {
                    pageNumber = i + 1;
                  } else if (effectivePage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = effectivePage - 2 + i;
                  }
                  
                  if (pageNumber > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => paginate(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        effectivePage === pageNumber
                          ? `z-10 bg-${isDark ? 'indigo-900' : 'indigo-50'} border-${isDark ? 'indigo-600' : 'indigo-500'} text-${isDark ? 'indigo-300' : 'indigo-600'}`
                          : `bg-${isDark ? 'gray-800' : 'white'} border-${isDark ? 'gray-600' : 'gray-300'} text-${isDark ? 'gray-200' : 'gray-700'} hover:bg-${isDark ? 'gray-700' : 'gray-50'}`
                      } ${i === 0 ? "rounded-l-md" : ""} ${
                        i === Math.min(5, totalPages) - 1 ? "rounded-r-md" : ""
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={nextPage}
                disabled={effectivePage === totalPages}
                className={`relative inline-flex items-center px-4 py-2 border border-${isDark ? 'gray-600' : 'gray-300'} text-sm font-medium rounded-md ${
                  effectivePage === totalPages
                    ? `bg-${isDark ? 'gray-700' : 'gray-100'} text-${isDark ? 'gray-400' : 'gray-700'} cursor-not-allowed`
                    : `bg-${isDark ? 'gray-800' : 'white'} text-${isDark ? 'gray-200' : 'gray-700'} hover:bg-${isDark ? 'gray-700' : 'gray-50'}`
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketList;
