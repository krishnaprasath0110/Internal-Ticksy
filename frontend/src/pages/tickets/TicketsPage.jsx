import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TicketList from '../../components/tickets/TicketList';
import { getStatus } from '../../services/status';
import NewTicketForm from '../../components/tickets/NewTicketForm';
import { ticketService } from '../../services/ticket';
import { getRoles } from '../../services/role';
import { userService } from '../../services/user';
import { ROLES } from '../../utils/roles';

const TicketsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTab, setSelectedTab] = useState('All');
  const [filters, setFilters] = useState({
    status: '',
    department: ''
  });
  const [successMessage, setSuccessMessage] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [resolutionTimeFilter, setResolutionTimeFilter] = useState('');
  const [agentIdFilter, setAgentIdFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [priorityFilterUI, setPriorityFilterUI] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [localResolutionFilter, setLocalResolutionFilter] = useState('');
  const [delayedFilter, setDelayedFilter] = useState('');
  const [frtBucketFilter, setFrtBucketFilter] = useState('');
  const [closureSlaFilter, setClosureSlaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [universityFilter, setUniversityFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(20);

  // Handle resolution filter change and update URL
  const handleResolutionFilterChange = (value) => {
    setLocalResolutionFilter(value);
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('resolution_time', value);
      params.delete('ageing');
    } else {
      params.delete('resolution_time');
      params.delete('ageing');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setResolutionTimeFilter(value);
  };

  // Handle priority filter change and update URL
  const handlePriorityFilterChange = (value) => {
    setPriorityFilterUI(value);
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('priority', value);
    } else {
      params.delete('priority');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setPriorityFilter(value);
  };

  // Handle status filter change and update URL
  const handleStatusFilterChange = (value) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('status', value);
    } else {
      params.delete('status');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setStatusFilter(value);
  };

  // Handle delayed filter change and update URL
  const handleDelayedFilterChange = (value) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('delayed', value);
    } else {
      params.delete('delayed');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setDelayedFilter(value);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedTab('All');
    setFilters({ status: '', department: '' });
    setSelectedAgent('');
    setDateRange({ startDate: '', endDate: '' });
    setResolutionTimeFilter('');
    setAgentIdFilter('');
    setPriorityFilter('');
    setPriorityFilterUI('');
    setLocalResolutionFilter('');
    setDelayedFilter('');
    setFrtBucketFilter('');
    setClosureSlaFilter('');
    setStatusFilter('');
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Initialize from URL parameters on mount FIRST
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resolutionTimeParam = params.get('resolution_time');
    const ageingParam = params.get('ageing');
    const agentIdParam = params.get('agent_id');
    const statusParam = params.get('status');
    const priorityParam = params.get('priority');
    const delayedParam = params.get('delayed');
    const frtBucketParam = params.get('frt_bucket');
    const closureSlaParam = params.get('closure_sla');
    const pageParam = params.get('page');
    const searchParam = params.get('search');
    const categoryParam = params.get('category_id') || params.get('category');
    const batchParam = params.get('batch_id') || params.get('batch');
    const programParam = params.get('program_id') || params.get('program');
    const universityParam = params.get('university_id') || params.get('university');
    const startDateParam = params.get('start_date');
    const endDateParam = params.get('end_date');

    // Restore page from URL
    if (pageParam) {
      setCurrentPage(parseInt(pageParam) || 1);
    }
    // Always sync these from URL so list state matches the address bar (and clears when params are removed)
    setSearchQuery(searchParam || '');
    setCategoryFilter(categoryParam || '');
    setBatchFilter(batchParam || '');
    setProgramFilter(programParam || '');
    setUniversityFilter(universityParam || '');
    setAgentIdFilter(agentIdParam || '');
    setStartDateFilter(startDateParam || '');
    setEndDateFilter(endDateParam || '');
    setFrtBucketFilter(frtBucketParam || '');
    setClosureSlaFilter(closureSlaParam || '');
    
    if (resolutionTimeParam || ageingParam || agentIdParam || priorityParam || delayedParam || frtBucketParam || closureSlaParam || statusParam) {
      // Handle resolution_time parameter (for closed tickets)
      if (resolutionTimeParam) {
        setResolutionTimeFilter(resolutionTimeParam);
        const resolvedStatus = statusParam || 'closed';
        setSelectedTab(resolvedStatus);
        setStatusFilter(resolvedStatus);
      }
      // Handle ageing parameter (for open tickets - FRT)
      else if (ageingParam) {
        setResolutionTimeFilter(ageingParam);
        const resolvedStatus = statusParam || 'open';
        setSelectedTab(resolvedStatus);
        setStatusFilter(resolvedStatus);
      }
      // Handle FRT bucket (open ticket analysis)
      else if (frtBucketParam) {
        const resolvedStatus = statusParam || 'open,in-progress';
        setSelectedTab(resolvedStatus);
        setStatusFilter(resolvedStatus);
      }
      // Handle closure SLA bucket
      else if (closureSlaParam) {
        const resolvedStatus = statusParam || 'open,in-progress';
        setSelectedTab(resolvedStatus);
        setStatusFilter(resolvedStatus);
      }
      // Handle status parameter alone
      else if (statusParam) {
        setSelectedTab(statusParam);
        setStatusFilter(statusParam);
      }
      
      if (agentIdParam) {
        setAgentIdFilter(agentIdParam);
      }
      if (priorityParam) {
        setPriorityFilter(priorityParam);
        setPriorityFilterUI(priorityParam);
      }
      if (delayedParam) {
        setDelayedFilter(delayedParam);
      }
      // Clear other filters to avoid conflicts
      setFilters({ status: '', department: '' });
      setSelectedAgent('');
      setDateRange({ startDate: '', endDate: '' });
    } else if (statusParam) {
      setSelectedTab(statusParam);
      setStatusFilter(statusParam);
      setFilters(prev => ({ ...prev, status: statusParam }));
    }
    
    // Mark as initialized after reading URL params
    setIsInitialized(true);
  }, [location.search]);

  // Sync page to URL whenever it changes
  useEffect(() => {
    if (!isInitialized) return;
    const params = new URLSearchParams(window.location.search);
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [currentPage, isInitialized]);

  // Fetch tickets ONLY after initialization
  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    
    fetchStatus();
    fetchRoles();
    fetchTickets();
  }, [filters, selectedAgent, dateRange, resolutionTimeFilter, agentIdFilter, priorityFilter, delayedFilter, frtBucketFilter, closureSlaFilter, statusFilter, searchQuery, categoryFilter, batchFilter, programFilter, universityFilter, startDateFilter, endDateFilter, isInitialized, currentPage]);

  const fetchStatus = async () => {
    try {
      const data = await getStatus();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles();
      setRoles(response);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      let params = {
        page: currentPage,
        page_size: pageSize,
      };
      
      // Add agent and priority filters if present
      if (agentIdFilter) {
        params.agent_id = agentIdFilter;
      }
      if (priorityFilter) {
        params.priority = priorityFilter;
      }
      
      // Handle delayed filter (checkbox)
      if (delayedFilter === 'true') {
        params.delayed = 'true';
      }

      if (frtBucketFilter) {
        params.frt_bucket = frtBucketFilter;
      }

      if (closureSlaFilter) {
        params.closure_sla = closureSlaFilter;
      }
      
      // Handle status filter from filter dropdown
      if (statusFilter) {
        params.status = statusFilter;
      }
      
      // Handle resolution time filter based on selected tab or status filter
      if (resolutionTimeFilter) {
        if (selectedTab === 'open' || statusFilter === 'open') {
          params.ageing = resolutionTimeFilter;
          params.status = 'open';
        } else if (selectedTab === 'closed' || statusFilter === 'closed') {
          params.resolution_time_range = resolutionTimeFilter;
          params.status = 'closed';
        }
      }
      
      // Add status filter if not "All" tab
      if (selectedTab !== 'All' && !statusFilter && !resolutionTimeFilter) {
        params.status = selectedTab;
      }
      
      // Add other filters
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department_id = filters.department;
      
      if (dateRange.startDate) {
        params.start_date = dateRange.startDate;
      }
      if (dateRange.endDate) {
        params.end_date = dateRange.endDate;
      }

      // Server-side search and additional filters
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter) params.category_id = categoryFilter;
      if (batchFilter) params.batch_id = batchFilter;
      if (programFilter) params.program_id = programFilter;
      if (universityFilter) params.university_id = universityFilter;
      if (startDateFilter) params.start_date = startDateFilter;
      if (endDateFilter) params.end_date = endDateFilter;
      
      const data = await ticketService.getTicketsPaginated(params);
      setTickets(data.tickets || []);
      setTotalTickets(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleNewTicket = async (ticketData) => {
    try {
      const response = await ticketService.createTicket(ticketData);
      await fetchTickets();
      setShowNewTicketForm(false);
      setSuccessMessage({
        ticketId: response.data.id,
        title: response.data.title
      });
      setTimeout(() => setSuccessMessage(null), 5000); // Hide after 5 seconds
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleCancel = () => {
    setShowNewTicketForm(false);
    navigate('/tickets');
  };

  const handleAgentChange = (event) => {
    setSelectedAgent(event.target.value);
  };

  const handleDateChange = (field) => (event) => {
    setDateRange(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Reset to page 1 when filters change
  const resetPage = () => {
    setCurrentPage(1);
  };

  // Handle search change from TicketList (server-side)
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.delete('page');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  // Handle additional filter changes from TicketList (server-side)
  const handleTicketListFilterChange = (filterObj) => {
    const { category, batch, program, university, agent_id, start_date, end_date } = filterObj;
    if (category !== undefined) setCategoryFilter(category);
    if (batch !== undefined) setBatchFilter(batch);
    if (program !== undefined) setProgramFilter(program);
    if (university !== undefined) setUniversityFilter(university);
    if (agent_id !== undefined) setAgentIdFilter(agent_id);
    if (start_date !== undefined) setStartDateFilter(start_date);
    if (end_date !== undefined) setEndDateFilter(end_date);
    setCurrentPage(1);
  };

  // Tickets are already filtered server-side, use directly
  const filteredTickets = tickets;

  return (
    <div className="min-h-screen py-2 sm:py-4 px-0 sm:px-4 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-4 sm:mb-6 px-4 sm:px-0">
          {successMessage && (
            <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
              <p>
                Ticket #{successMessage.ticketId} "{successMessage.title}" created successfully!
              </p>
            </div>
          )}
          
        </div>
        
        {showNewTicketForm ? (
          <div className="p-4 sm:p-6">
            <NewTicketForm
              onSubmit={handleNewTicket}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <div>
            <div className="mt-4">
              <TicketList
                loading={loading}
                tickets={filteredTickets}
                    resolutionTimeFilter={resolutionTimeFilter}
                    priorityFilterValue={priorityFilter}
                    agentIdFilter={agentIdFilter}
                    syncedCategoryFilter={categoryFilter}
                    syncedBatchFilter={batchFilter}
                    syncedProgramFilter={programFilter}
                    syncedUniversityFilter={universityFilter}
                    statusFilterValue={statusFilter}
                    delayedFilterValue={delayedFilter}
                    searchValue={searchQuery}
                    onSearchChange={handleSearchChange}
                    onTicketListFilterChange={handleTicketListFilterChange}
                    onResolutionFilterChange={(v) => { handleResolutionFilterChange(v); resetPage(); }}
                    onPriorityFilterChange={(v) => { handlePriorityFilterChange(v); resetPage(); }}
                    onStatusFilterChange={(v) => { handleStatusFilterChange(v); resetPage(); }}
                    onDelayedFilterChange={(v) => { handleDelayedFilterChange(v); resetPage(); }}
                    onClearAllFilters={() => { clearAllFilters(); setSearchQuery(''); setCategoryFilter(''); setBatchFilter(''); setProgramFilter(''); setUniversityFilter(''); setAgentIdFilter(''); setStartDateFilter(''); setEndDateFilter(''); resetPage(); }}
                    serverPagination={{
                      currentPage,
                      totalPages,
                      totalTickets,
                      pageSize,
                      onPageChange: setCurrentPage,
                    }}
                  />
                  {!loading && filteredTickets.length === 0 && (
                    <div className="bg-white rounded-none sm:rounded-lg shadow-sm overflow-hidden text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by creating a new ticket.</p>
                      <div className="mt-6">
                        <button
                          onClick={() => setShowNewTicketForm(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          New Ticket
                        </button>
                      </div>
                    </div>
                  )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;
