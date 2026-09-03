import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ticketService } from '../../services/ticket';
import { userService } from '../../services/user';
import { dashboardService } from '../../services/dashboard';
import { getPrograms } from '../../services/program';
import { getBatches } from '../../services/batch';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import AgentsList from '../../components/dashboard/AgentsList';
import AgentMetrics from '../../components/dashboard/AgentMetrics';
import ResolutionTimeMetrics from '../../components/dashboard/ResolutionTimeMetrics';
import PriorityMetrics from '../../components/dashboard/PriorityMetrics';
import FRTMetrics from '../../components/dashboard/FRTMetrics';
import ClosureSlaHealth from '../../components/dashboard/ClosureSlaHealth';
import AgentActiveTicketBreakdown from '../../components/dashboard/AgentActiveTicketBreakdown';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Paper, 
  Tabs, 
  Tab, 
  Divider,
  Fade,
  Zoom,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { 
  Inbox, 
  AccessTime, 
  CheckCircle, 
  HourglassEmpty, 
  Block, 
  Refresh,
  TrendingUp,
  TrendingDown,
  ErrorOutline,
  Dashboard as DashboardIcon,
  FormatListBulleted,
  Add,
  DashboardCustomize
} from '@mui/icons-material';

const getAgentBatchIds = (agent) => {
  if (agent.batch_ids?.length) {
    return agent.batch_ids.map((id) => Number(id));
  }
  return (agent.user_batches || [])
    .map((ub) => ub.batch?.id)
    .filter(Boolean)
    .map((id) => Number(id));
};

const filterAgentsByProgramBatch = (agentList, programId, batchId, batchList) => {
  if (!programId && !batchId) {
    return agentList;
  }

  return agentList.filter((agent) => {
    const agentBatchIds = getAgentBatchIds(agent);
    if (agentBatchIds.length === 0) {
      return false;
    }

    if (batchId) {
      return agentBatchIds.includes(Number(batchId));
    }

    const programBatchIds = batchList
      .filter((b) => String(b.program_id) === String(programId))
      .map((b) => Number(b.id));

    return agentBatchIds.some((id) => programBatchIds.includes(id));
  });
};

// Enhanced Ticket Card with animations and better UI
const TicketCard = ({ title, count, color, icon, previousCount = null, totalCount = null }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // Calculate percentage change if previous count is provided
  const hasChange = previousCount !== null;
  const percentChange = hasChange 
    ? previousCount === 0 
      ? count > 0 ? 100 : 0
      : Math.round(((count - previousCount) / previousCount) * 100)
    : null;
  
  const isIncrease = percentChange > 0;
  const isDecrease = percentChange < 0;
  
  // Calculate percentage of total if totalCount is provided
  const percentOfTotal = totalCount && totalCount > 0 ? Math.round((count / totalCount) * 100) : null;
  
  return (
    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
      <Card 
        sx={{ 
          height: '90%',
          borderRadius: 4,
          boxShadow: '0 2px 4px 0 rgba(0,0,0,0.05)',
          transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
          border: `1px solid ${isDarkMode ? '#334155' : '#e6e9f0'}`,
          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 8px 0 rgba(0,0,0,0.1)',
          }
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
              {title}
            </Typography>
            <Box sx={{ 
              backgroundColor: `${color}20`, 
              borderRadius: '50%', 
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {icon}
            </Box>
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
            {count}
          </Typography>
          
          {/* Progress bar for percentage of total */}
          {percentOfTotal !== null && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '0.75rem' }}>
                  {percentOfTotal}% of total
                </Typography>
              </Box>
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 6, 
                  backgroundColor: isDarkMode ? '#334155' : '#e2e8f0',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${percentOfTotal}%`,
                    backgroundColor: color,
                    transition: 'width 0.3s ease'
                  }}
                />
              </Box>
            </Box>
          )}
          
          {hasChange && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              {isIncrease ? (
                <TrendingUp fontSize="small" sx={{ color: '#f44336', mr: 0.5 }} />
              ) : isDecrease ? (
                <TrendingDown fontSize="small" sx={{ color: '#4caf50', mr: 0.5 }} />
              ) : (
                <Box sx={{ width: 18, mr: 0.5 }} /> // Empty space for alignment
              )}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: isIncrease ? '#f44336' : isDecrease ? '#4caf50' : 'text.secondary',
                  fontWeight: 500
                }}
              >
                {Math.abs(percentChange)}% {isIncrease ? 'increase' : isDecrease ? 'decrease' : 'no change'} from last week
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Zoom>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [ticketCounts, setTicketCounts] = useState({
    total: 0, open: 0, in_progress: 0, closed: 0,
    not_applicable: 0, delayed: 0, delayed_open: 0,
    delayed_in_progress: 0, delayed_closed: 0
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mainTab, setMainTab] = useState('dashboard');
  const [ticketTab, setTicketTab] = useState('overview');
  const [agentDashboardData, setAgentDashboardData] = useState(null);
  const [loadingAgentData, setLoadingAgentData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentTicketsLoaded, setRecentTicketsLoaded] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(false);

  const programBatchFilters = {
    programId: selectedProgramId,
    batchId: selectedBatchId,
  };

  const filteredBatches = selectedProgramId
    ? batches.filter((b) => String(b.program_id) === String(selectedProgramId))
    : batches;

  const filteredAgents = useMemo(
    () => filterAgentsByProgramBatch(agents, selectedProgramId, selectedBatchId, batches),
    [agents, selectedProgramId, selectedBatchId, batches]
  );

  const showProgramBatchFilters = [
    ROLES.ADMIN,
    ROLES.DEPARTMENT_MANAGER,
    ROLES.DEPARTMENT_SUPERVISOR,
  ].includes(user?.role?.name);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // If the user is an agent, fetch their own dashboard data
      if (user.role?.name === ROLES.AGENT) {
        fetchAgentDashboard(user.id);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!showProgramBatchFilters) return;
    const loadProgramBatchOptions = async () => {
      try {
        const [programsData, batchesData] = await Promise.all([
          getPrograms(),
          getBatches(),
        ]);
        setPrograms(programsData || []);
        setBatches(batchesData || []);
      } catch (err) {
        console.error('Failed to load program/batch filters:', err);
      }
    };
    loadProgramBatchOptions();
  }, [showProgramBatchFilters]);

  const applyProgramBatchFilters = async (programId, batchId) => {
    const filters = { programId, batchId };
    setFiltersLoading(true);
    try {
      await fetchTicketCounts(filters);

      const matchingAgents = filterAgentsByProgramBatch(
        agents,
        programId,
        batchId,
        batches
      );

      if (
        selectedAgent &&
        !matchingAgents.some((agent) => agent.id === selectedAgent.id)
      ) {
        setSelectedAgent(null);
        setAgentDashboardData(null);
      } else if (selectedAgent) {
        await fetchAgentDashboard(selectedAgent.id, filters);
      }
    } finally {
      setFiltersLoading(false);
    }
  };

  const fetchAgentDashboard = async (agentId, filters) => {
    if (agentId) {
      try {
        setLoadingAgentData(true);
        const data = await ticketService.getAgentDashboard(agentId, filters);
        setAgentDashboardData(data);
      } catch (err) {
        console.error('Failed to fetch agent dashboard:', err);
      } finally {
        setLoadingAgentData(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    fetchAgentDashboard(selectedAgent.id, {
      programId: selectedProgramId,
      batchId: selectedBatchId,
    });
    // Program/batch changes refetch via applyProgramBatchFilters when an agent is selected
  }, [selectedAgent]);

  const fetchTicketCounts = async (filters = programBatchFilters) => {
    try {
      const countsData = await dashboardService.getDashboardTicketCounts(filters);
      setTicketCounts(countsData || {
        total: 0, open: 0, in_progress: 0, closed: 0,
        not_applicable: 0, delayed: 0, delayed_open: 0,
        delayed_in_progress: 0, delayed_closed: 0
      });
    } catch (err) {
      console.error('Error fetching ticket counts:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let agentsPromise = Promise.resolve([]);
      
      // Fetch agents based on user role
      if (user?.role?.name === ROLES.DEPARTMENT_SUPERVISOR || 
          user?.role?.name === ROLES.DEPARTMENT_MANAGER) {
        if (user?.user_departments && user.user_departments.length > 0) {
          const departmentIds = user.user_departments.map(dept => dept.id);
          const agentPromises = departmentIds.map(deptId => 
            userService.getUsers({ 
              role: ROLES.AGENT,
              department_id: Number(deptId)
            })
          );
          
          agentsPromise = Promise.all(agentPromises).then(results => {
            const allAgents = results.flat();
            return Array.from(
              new Map(allAgents.map(agent => [agent.id, agent])).values()
            );
          });
        }
      } else if (user?.role?.name === ROLES.ADMIN) {
        agentsPromise = userService.getUsers({ role: ROLES.AGENT });
      }

      const [countsData, agentsData] = await Promise.all([
        dashboardService.getDashboardTicketCounts(programBatchFilters),
        agentsPromise
      ]);

      const activeAgents = (agentsData || []).filter((agent) => agent.is_active !== false);

      setTicketCounts(countsData || {
        total: 0, open: 0, in_progress: 0, closed: 0,
        not_applicable: 0, delayed: 0, delayed_open: 0,
        delayed_in_progress: 0, delayed_closed: 0
      });
      setAgents(activeAgents);
      if (selectedAgent && !activeAgents.some((agent) => agent.id === selectedAgent.id)) {
        setSelectedAgent(null);
        setAgentDashboardData(null);
      }
      setError(null);
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load recent tickets only when the Recent Tickets tab is opened
  const fetchRecentTickets = async () => {
    if (recentTicketsLoaded) return;
    try {
      const data = await ticketService.getTicketsPaginated({ page: 1, page_size: 10 });
      setRecentTickets(data.tickets || []);
      setRecentTicketsLoaded(true);
    } catch (err) {
      console.error('Error fetching recent tickets:', err);
    }
  };

  useEffect(() => {
    if (mainTab === 'tickets' || user?.role?.name === 'candidate') {
      fetchRecentTickets();
    }
  }, [mainTab, user?.role?.name]);

  // Handle refresh button click
  const handleRefresh = async () => {
    setRefreshing(true);
    setRecentTicketsLoaded(false);
    await fetchData();
    if (user?.role?.name === ROLES.AGENT) {
      await fetchAgentDashboard(user.id);
    } else if (selectedAgent) {
      await fetchAgentDashboard(selectedAgent.id);
    }
    if (mainTab === 'tickets' || user?.role?.name === 'candidate') {
      await fetchRecentTickets();
    }
    setRefreshing(false);
  };

  // Recent tickets filtered by status (for Recent Tickets tab)
  const openRecentTickets = recentTickets.filter(t => t.status?.name === 'open');
  const inProgressRecentTickets = recentTickets.filter(t => t.status?.name === 'in-progress');

  if (loading) {
    return (
      <div className="h-full bg-[#f8f9fe] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-[#f8f9fe] dark:bg-gray-900">
        <div className="h-full max-w-[1920px] mx-auto p-8">
          <Paper 
            elevation={0}
            sx={{ 
              p: 4, 
              borderRadius: 2,
              border: `1px solid ${theme.palette.error.main}20`,
              bgcolor: `${theme.palette.error.main}10`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <ErrorOutline color="error" sx={{ mr: 2, mt: 0.5 }} />
              <Box>
                <Typography variant="h6" color="error" gutterBottom>
                  Error Loading Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {error}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label="Try Again" 
                    color="primary" 
                    onClick={handleRefresh} 
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        </div>
      </div>
    );
  }

  // Get department name for the header
  const getDepartmentName = () => {
    if (user?.user_departments?.[0]?.department?.name) {
      return user.user_departments[0].department.name;
    }
    return '';
  };

  const handleProgramChange = (event) => {
    const value = event.target.value;
    setSelectedBatchId('');
    setSelectedProgramId(value);
    applyProgramBatchFilters(value, '');
  };

  const handleBatchChange = (event) => {
    const value = event.target.value;
    setSelectedBatchId(value);
    applyProgramBatchFilters(selectedProgramId, value);
  };

  const renderProgramBatchFilters = () => {
    if (!showProgramBatchFilters) return null;
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fff',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="dashboard-program-label">Program</InputLabel>
              <Select
                labelId="dashboard-program-label"
                label="Program"
                value={selectedProgramId}
                onChange={handleProgramChange}
                disabled={filtersLoading}
              >
                <MenuItem value="">
                  <em>All programs</em>
                </MenuItem>
                {programs.map((program) => (
                  <MenuItem key={program.id} value={String(program.id)}>
                    {program.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="dashboard-batch-label">Batch</InputLabel>
              <Select
                labelId="dashboard-batch-label"
                label="Batch"
                value={selectedBatchId}
                onChange={handleBatchChange}
                disabled={!selectedProgramId || filtersLoading}
              >
                <MenuItem value="">
                  <em>All batches</em>
                </MenuItem>
                {filteredBatches.map((batch) => (
                  <MenuItem key={batch.id} value={String(batch.id)}>
                    {batch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'flex-start', md: 'start' },
              minHeight: 40,
            }}
          >
            {filtersLoading && (
              <CircularProgress size={30} aria-label="Updating dashboard filters" />
            )}

          </Grid>
        </Grid>
      </Paper>
    );
  };

  const renderDashboardContent = () => (
    <>
      {renderProgramBatchFilters()}

      {/* Ticket Statistics - Only show for non-agents or when no agent is selected */}
      {/* {(user?.role?.name !== ROLES.AGENT || !agentDashboardData) && ( */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4} lg={2.4}>
            <Link to="/tickets?status=open,in-progress" style={{ textDecoration: 'none' }}>
              <TicketCard
                title="Total Active"
                count={ticketCounts.open + ticketCounts.in_progress}
                color="#f97316"
                icon={<AccessTime sx={{ color: '#f97316' }} />}
              />
            </Link>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2.4}>
            <Link to="/tickets?status=open" style={{ textDecoration: 'none' }}>
              <TicketCard 
                title="Open Tickets" 
                count={ticketCounts.open} 
                color="#ff9800" 
                icon={<ErrorOutline sx={{ color: '#ff9800' }} />} 
              />
            </Link>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2.4}>
            <Link to="/tickets?status=in-progress" style={{ textDecoration: 'none' }}>
              <TicketCard 
                title="In Progress" 
                count={ticketCounts.in_progress} 
                color="#2196f3" 
                icon={<HourglassEmpty sx={{ color: '#2196f3' }} />} 
              />
            </Link>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2.4}>
            <Link to="/tickets?status=closed" style={{ textDecoration: 'none' }}>
              <TicketCard 
                title="Closed" 
                count={ticketCounts.closed} 
                color="#4caf50" 
                icon={<CheckCircle sx={{ color: '#4caf50' }} />} 
              />
            </Link>
          </Grid>
          {user?.role?.name !== 'candidate' && (
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <Zoom in={true} style={{ transitionDelay: '120ms' }}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 4,
                    border: `1px solid ${isDarkMode ? 'rgba(248, 113, 113, 0.35)' : '#fee2e2'}`,
                    background: isDarkMode ? 'linear-gradient(135deg, rgba(244,67,54,0.12), rgba(244,67,54,0.05))' : 'linear-gradient(135deg, #fff5f5, #fef2f2)',
                    boxShadow: '0 2px 6px rgba(244,67,54,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDarkMode ? '#fecaca' : '#b91c1c' }}>
                        Delayed Tickets
                      </Typography>
                      <Box
                        sx={{
                          backgroundColor: isDarkMode ? 'rgba(244,67,54,0.25)' : '#fee2e2',
                          borderRadius: 2,
                          p: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AccessTime sx={{ color: '#f87171' }} />
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 1,
                      }}
                    >
                      {[{
                        label: 'Open',
                        count: ticketCounts.delayed_open,
                        color: '#f97316',
                        border: '#fdba74',
                        to: '/tickets?delayed=true&status=open',
                      }, {
                        label: 'In Progress',
                        count: ticketCounts.delayed_in_progress,
                        color: '#2563eb',
                        border: '#bfdbfe',
                        to: '/tickets?delayed=true&status=in-progress',
                      }].map((item, idx) => (
                        <Link key={idx} to={item.to} style={{ textDecoration: 'none' }}>
                          <Box
                            sx={{
                              borderRadius: 3,
                              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : item.border}`,
                              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#fff',
                              p: 1,
                              transition: 'all 0.25s ease',
                              height: '100%',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: `0 6px 12px ${isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(249,115,22,0.18)'}`,
                                borderColor: item.color,
                              },
                            }}
                          >
                            <Typography variant="caption" sx={{ letterSpacing: 0.4, color: isDarkMode ? '#cbd5f5' : '#6b7280', fontWeight: 600, fontSize: '10px' }}>
                              {item.label}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: isDarkMode ? '#f8fafc' : '#1f2937' }}>
                              {item.count}
                            </Typography>
                          </Box>
                        </Link>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          )}
        </Grid>
      {/* )} */}

      {/* Open Ticket Analysis → SLA Health → Agent breakdown */}
      {user?.role?.name !== ROLES.CANDIDATE && user?.role?.name !== ROLES.AGENT && (
        <Box sx={{ mb: 4 }}>
          <ResolutionTimeMetrics
            programId={selectedProgramId}
            batchId={selectedBatchId}
          />
        </Box>
      )}

      {(user?.role?.name === ROLES.DEPARTMENT_MANAGER ||
        user?.role?.name === ROLES.DEPARTMENT_SUPERVISOR ||
        user?.role?.name === 'admin') && (
        <>
          <Box sx={{ mb: 4 }}>
            <ClosureSlaHealth
              programId={selectedProgramId}
              batchId={selectedBatchId}
            />
          </Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} lg={6}>
              <AgentActiveTicketBreakdown
                programId={selectedProgramId}
                batchId={selectedBatchId}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <PriorityMetrics
                programId={selectedProgramId}
                batchId={selectedBatchId}
              />
            </Grid>
          </Grid>
        </>
      )}

      {/* FRT Metrics - Show for managers, supervisors, and admin only */}
      {(user?.role?.name === ROLES.DEPARTMENT_MANAGER || 
        user?.role?.name === ROLES.DEPARTMENT_SUPERVISOR || 
        user?.role?.name === 'admin') && (
        <Box sx={{ mb: 4 }}>
          <FRTMetrics
            programId={selectedProgramId}
            batchId={selectedBatchId}
          />
        </Box>
      )}

      {/* Manager/Supervisor View - Agents Section */}
      {(user?.role?.name === ROLES.DEPARTMENT_MANAGER || user?.role?.name === ROLES.DEPARTMENT_SUPERVISOR || user?.role?.name === 'admin') && (
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 2, 
            overflow: 'hidden',
            mb: 4,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Box sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {user?.role?.name === 'admin' ? 'Agent Performance' : `${getDepartmentName()} Department Agent Performance`}
            </Typography>
          </Box>
          <Divider />
          <Grid container>
            <Grid item xs={12} md={3} sx={{ 
              borderRight: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}>
              <Box sx={{ p: 2 }}>
                <AgentsList
                  agents={filteredAgents}
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={9}>
              <Box sx={{ p: 2 }}>
                {selectedAgent ? (
                  loadingAgentData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </Box>
                  ) : (
                    <AgentMetrics 
                      agent={selectedAgent} 
                      tickets={agentDashboardData?.tickets || []} 
                      categoryBreakdown={agentDashboardData?.category_breakdown || []} 
                    />
                  )
                ) : (
                  <Box sx={{ 
                    p: 4, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    borderRadius: 1
                  }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      Select an agent to view their metrics
                    </Typography>
                    <Chip 
                      label="Select an Agent" 
                      color="primary" 
                      variant="outlined" 
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Candidate Recent Tickets Section */}
      {user?.role?.name === 'candidate' && (
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 2, 
            overflow: 'hidden',
            mb: 4,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Box sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recent Tickets
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <RecentTicketsList 
              tickets={recentTickets.slice(0, 10)} 
              emptyMessage="No tickets found" 
              showStatus
            />
          </Box>
        </Paper>
      )}

      {/* Agent View - Self Metrics */}
      {user?.role?.name === ROLES.AGENT && (
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 2, 
            overflow: 'hidden',
            mb: 4,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Box sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              My Performance Metrics
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            {loadingAgentData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </Box>
            ) : (
              <AgentMetrics 
                agent={user} 
                tickets={agentDashboardData?.tickets || []} 
                categoryBreakdown={agentDashboardData?.category_breakdown || []} 
              />
            )}
          </Box>
        </Paper>
      )}
    </>
  );

  const renderRecentTicketsContent = () => (
    <Paper 
      elevation={0} 
      sx={{ 
        borderRadius: 2, 
        overflow: 'hidden',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={ticketTab} 
          onChange={(e, newValue) => setTicketTab(newValue)}
          sx={{ 
            px: 2, 
            pt: 1,
            '& .MuiTab-root': {
              minHeight: '48px',
              textTransform: 'none',
              fontWeight: 500,
            }
          }}
        >
          <Tab 
            label="Overview" 
            value="overview" 
            icon={<Inbox fontSize="small" />} 
            iconPosition="start"
          />
          <Tab 
            label="All Recent Tickets" 
            value="all" 
            icon={<AccessTime fontSize="small" />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      {ticketTab === 'overview' ? (
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Recent Open Tickets
                </Typography>
                <RecentTicketsList 
                  tickets={openRecentTickets.slice(0, 5)} 
                  emptyMessage="No open tickets" 
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Recent In Progress Tickets
                </Typography>
                <RecentTicketsList 
                  tickets={inProgressRecentTickets.slice(0, 5)} 
                  emptyMessage="No tickets in progress" 
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            All Recent Tickets
          </Typography>
          <RecentTicketsList 
            tickets={recentTickets.slice(0, 10)} 
            emptyMessage="No tickets found" 
            showStatus
          />
        </Box>
      )}
    </Paper>
  );

  return (
    <Fade in={true}>
      <Box 
        sx={{ 
          height: '100%', 
          bgcolor: theme => theme.palette.mode === 'dark' ? 'grey.900' : '#f8f9fe',
          pb: 4
        }}
      >
        <Box sx={{ height: '100%', maxWidth: '1920px', mx: 'auto', px: 4 }}>
          <Box sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <DashboardCustomize sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Dashboard
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {/* Only show tabs in header for non-candidates */}
                {user?.role?.name !== 'candidate' && (
                  <Tabs 
                    value={mainTab} 
                    onChange={(e, newValue) => setMainTab(newValue)}
                    sx={{ 
                      mr: 2,
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 500,
                      }
                    }}
                  >
                    <Tab 
                      label="Dashboard" 
                      value="dashboard" 
                      icon={<DashboardIcon fontSize="small" />} 
                      iconPosition="start"
                    />
                    <Tab 
                      label="Recent Tickets" 
                      value="tickets" 
                      icon={<FormatListBulleted fontSize="small" />} 
                      iconPosition="start"
                    />
                  </Tabs>
                )}
                <Tooltip title="Refresh Data">
                  <IconButton 
                    onClick={handleRefresh} 
                    sx={{ 
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      '&:hover': {
                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      }
                    }}
                    disabled={refreshing}
                  >
                    <Refresh className={refreshing ? 'animate-spin' : ''} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* For non-candidates, use the mainTab state to determine content */}
            {user?.role?.name !== 'candidate' ? (
              mainTab === 'dashboard' ? renderDashboardContent() : renderRecentTicketsContent()
            ) : (
              // For candidates, always show dashboard content first
              <>
                {renderDashboardContent()}

              </>
            )}
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

// New component for displaying recent tickets with modern styling
const RecentTicketsList = ({ tickets, emptyMessage, showStatus = false }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  if (tickets.length === 0) {
    return (
      <Box sx={{ 
        p: 3, 
        textAlign: 'center',
        bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        borderRadius: 1
      }}>
        <Typography color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ 
      bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      borderRadius: 1,
    }}>
      {tickets.map((ticket, index) => (
        <React.Fragment key={ticket.id}>
          <Fade in={true} style={{ transitionDelay: `${index * 30}ms` }}>
            <Box>
              <Link to={`/tickets/${ticket.id}`} style={{ textDecoration: 'none' }}>
                <Box sx={{ 
                  p: 2, 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    transform: 'translateX(4px)'
                  },
                  color: 'text.primary'
                }}>
                  <Box sx={{ flex: 1, pr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Ticket #{ticket.id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 500,
                      mb: 0.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {ticket.title?.substring(0, 200)}
                      {ticket.title?.length > 200 ? '...' : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {ticket.description?.substring(0, 300)}
                      {ticket.description?.length > 300 ? '...' : ''}
                    </Typography>
                  </Box>
                  {showStatus && (
                    <Chip 
                      label={ticket.status.name} 
                      size="small"
                      sx={{ 
                        bgcolor: getStatusColor(ticket.status.name, 0.1),
                        color: getStatusColor(ticket.status.name, 1),
                        fontWeight: 500,
                        minWidth: 90,
                        justifyContent: 'center'
                      }}
                    />
                  )}
                </Box>
              </Link>
              {index < tickets.length - 1 && (
                <Divider />
              )}
            </Box>
          </Fade>
        </React.Fragment>
      ))}
    </Box>
  );
};

// Helper function to get color based on ticket status
const getStatusColor = (status, opacity = 1) => {
  const colors = {
    'open': `rgba(255, 152, 0, ${opacity})`,
    'in-progress': `rgba(33, 150, 243, ${opacity})`,
    'closed': `rgba(76, 175, 80, ${opacity})`,
    'not-applicable': `rgba(158, 158, 158, ${opacity})`
  };
  
  return colors[status] || colors['open'];
};

export default DashboardPage;
