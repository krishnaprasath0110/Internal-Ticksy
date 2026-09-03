import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { dashboardService } from '../../services/dashboard';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress
} from '@mui/material';

const SHOW_OVERALL_PRIORITY_DISTRIBUTION = false;
const AGENT_TABLE_MAX_HEIGHT = 440;

const PriorityMetrics = ({ startDate, endDate, programId = '', batchId = '' }) => {
  const programBatchFilters = { programId, batchId };
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [agentMetrics, setAgentMetrics] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('all');

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate, programId, batchId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [overallData, agentData] = await Promise.all([
        dashboardService.getPriorityMetrics(startDate, endDate, programBatchFilters),
        dashboardService.getAgentPriorityMetrics(startDate, endDate, programBatchFilters)
      ]);
      
      setMetrics(overallData);
      setAgentMetrics(agentData);
    } catch (err) {
      console.error('Error fetching priority metrics:', err);
      setError(err.detail || 'Failed to load priority metrics');
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityClick = (priority) => {
    // Navigate to tickets page with priority filter
    navigate(`/tickets?priority=${priority.toLowerCase()}`);
  };

  const handleAgentPriorityClick = (agentId, priority) => {
    navigate(`/tickets?agent_id=${agentId}&priority=${priority.toLowerCase()}&status=open,in-progress`);
  };

  // Priority Card Component
  const PriorityCard = ({ label, count, color, borderColor, percentage }) => (
    <Box
      onClick={() => handlePriorityClick(label.toLowerCase().replace(' priority', ''))}
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 2,
        borderLeft: `4px solid ${borderColor}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 600, 
            color: color,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.05em'
          }}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
          {percentage}%
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: color, mb: 1 }}>
        {count}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: `${borderColor}20`,
          mb: 1,
          '& .MuiLinearProgress-bar': {
            bgcolor: borderColor,
            borderRadius: 2
          }
        }}
      />
      <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
        {percentage}% of total
      </Typography>
    </Box>
  );

  // Donut Chart Component
  const DonutChart = () => {
    const total = metrics?.total || 0;
    const high = metrics?.high || 0;
    const medium = metrics?.medium || 0;
    const low = metrics?.low || 0;

    // Calculate percentages for the donut
    const highPercent = total > 0 ? (high / total) * 100 : 0;
    const mediumPercent = total > 0 ? (medium / total) * 100 : 0;
    const lowPercent = total > 0 ? (low / total) * 100 : 0;

    // Create conic gradient for donut
    const gradient = `conic-gradient(
      #ef4444 0% ${highPercent}%,
      #f59e0b ${highPercent}% ${highPercent + mediumPercent}%,
      #22c55e ${highPercent + mediumPercent}% 100%
    )`;

  };

  if (loading) {
    return (
      <Card sx={{ 
        bgcolor: isDark ? '#1e293b' : '#fff', 
        borderRadius: 2,
        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
      }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ 
        bgcolor: isDark ? '#1e293b' : '#fff',
        borderRadius: 2,
        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
      }}>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const calculatePercentage = (count) => {
    return metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
  };

  const activePriorityTotal = agentMetrics.reduce((sum, agent) => sum + agent.total, 0);

  return (
    <Card sx={{ 
      bgcolor: isDark ? '#1e293b' : '#fff',
      borderRadius: 2,
      boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: isDark ? '#fff' : '#111827', mb: 0.5 }}>
              Priority Metrics
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
              Agent-wise active ticket priority breakdown
            </Typography>
          </Box>

        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {SHOW_OVERALL_PRIORITY_DISTRIBUTION && (
            <Box sx={{ width: '500px', flexShrink: 0, mb: 3 }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 600, 
                  color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  mb: 2
                }}
              >
                Overall Distribution
              </Typography>

              <PriorityCard
                label="High Priority"
                count={metrics.high}
                color="#ef4444"
                borderColor="#ef4444"
                percentage={calculatePercentage(metrics.high)}
              />

              <PriorityCard
                label="Medium Priority"
                count={metrics.medium}
                color="#f59e0b"
                borderColor="#f59e0b"
                percentage={calculatePercentage(metrics.medium)}
              />

              <PriorityCard
                label="Low Priority"
                count={metrics.low}
                color="#22c55e"
                borderColor="#22c55e"
                percentage={calculatePercentage(metrics.low)}
              />

              <DonutChart />
            </Box>
          )}

          <TableContainer 
            component={Paper} 
            sx={{ 
              boxShadow: 'none', 
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              maxHeight: AGENT_TABLE_MAX_HEIGHT,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-track': { background: isDark ? 'rgba(255,255,255,0.1)' : '#e6e9f0' },
              '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.3)' : '#8b92aa', borderRadius: '3px' }
            }}
          >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                    <TableCell sx={{ fontWeight: 600, color: isDark ? '#fff' : '#374151', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Agent
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      High
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Medium
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#22c55e', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Low
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: isDark ? '#fff' : '#374151', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Total Active
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agentMetrics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                        No agent data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentMetrics.map((agent) => (
                      <TableRow 
                        key={agent.agent_id}
                        sx={{ 
                          '&:hover': { 
                            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' 
                          }
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#fff' : '#111827' }}>
                              {agent.agent_name}
                            </Typography>
                            {agent.departments && agent.departments.length > 0 && (
                              <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                                {agent.departments.join(' · ')}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell 
                          align="center"
                          onClick={() => agent.high > 0 && handleAgentPriorityClick(agent.agent_id, 'high')}
                          sx={{ 
                            cursor: agent.high > 0 ? 'pointer' : 'default',
                            color: agent.high > 0 ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'),
                            fontWeight: agent.high > 0 ? 600 : 400,
                            '&:hover': agent.high > 0 ? { textDecoration: 'underline' } : {}
                          }}
                        >
                          {agent.high}
                        </TableCell>
                        <TableCell 
                          align="center"
                          onClick={() => agent.medium > 0 && handleAgentPriorityClick(agent.agent_id, 'medium')}
                          sx={{ 
                            cursor: agent.medium > 0 ? 'pointer' : 'default',
                            color: agent.medium > 0 ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'),
                            fontWeight: agent.medium > 0 ? 600 : 400,
                            '&:hover': agent.medium > 0 ? { textDecoration: 'underline' } : {}
                          }}
                        >
                          {agent.medium}
                        </TableCell>
                        <TableCell 
                          align="center"
                          onClick={() => agent.low > 0 && handleAgentPriorityClick(agent.agent_id, 'low')}
                          sx={{ 
                            cursor: agent.low > 0 ? 'pointer' : 'default',
                            color: agent.low > 0 ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'),
                            fontWeight: agent.low > 0 ? 600 : 400,
                            '&:hover': agent.low > 0 ? { textDecoration: 'underline' } : {}
                          }}
                        >
                          {agent.low}
                        </TableCell>
                        <TableCell 
                          align="center"
                          sx={{ 
                            color: '#3b82f6',
                            fontWeight: 600
                          }}
                        >
                          {agent.total}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PriorityMetrics;
