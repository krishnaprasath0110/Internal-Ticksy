import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  useTheme,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { dashboardService } from '../../services/dashboard';

const AGENT_TABLE_MAX_HEIGHT = 440;

const AgentActiveTicketBreakdown = ({ programId = '', batchId = '' }) => {
  const programBatchFilters = { programId, batchId };
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [agentMetrics, setAgentMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentMetrics();
  }, [programId, batchId]);

  const fetchAgentMetrics = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getAgentOpenTicketAgeingMetrics(null, null, programBatchFilters);
      setAgentMetrics(data || []);
    } catch (err) {
      console.error('Error fetching agent active ticket metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentStatusClick = (agentId, status) => {
    const params = new URLSearchParams({ agent_id: String(agentId) });
    if (status === 'open') params.set('status', 'open');
    else if (status === 'in-progress') params.set('status', 'in-progress');
    else params.set('status', 'open,in-progress');
    navigate(`/tickets?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Agent-wise Active Ticket Breakdown</Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Fade in>
      <Card
        sx={{
          borderRadius: 2,
          boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
          border: '1px solid #e6e9f0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CardContent sx={{ p: 3, pb: 2, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#111827' }}>
            Agent-wise Active Ticket Breakdown
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280', mt: 0.5 }}>
            Open, in progress, and total active tickets per agent
          </Typography>
        </CardContent>

        <TableContainer
          component={Paper}
          sx={{
            flex: 1,
            minHeight: 0,
            maxHeight: AGENT_TABLE_MAX_HEIGHT,
            overflowY: 'auto',
            boxShadow: 'none',
            borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fff',
            mx: 3,
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': { background: isDarkMode ? 'rgba(255,255,255,0.3)' : '#8b92aa', borderRadius: '3px' },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>Agent</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: '#ff9800', textTransform: 'uppercase', fontSize: '0.75rem' }}>Open</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: '#2196f3', textTransform: 'uppercase', fontSize: '0.75rem' }}>In Progress</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: '#f97316', textTransform: 'uppercase', fontSize: '0.75rem' }}>Total Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agentMetrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                    No active tickets
                  </TableCell>
                </TableRow>
              ) : (
                agentMetrics.map((agent) => (
                  <TableRow key={agent.agent_id} sx={{ '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f9fafb' } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{agent.agent_name}</Typography>
                      {agent.departments?.length > 0 && (
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                          {agent.departments.join(' · ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      align="center"
                      onClick={() => agent.open > 0 && handleAgentStatusClick(agent.agent_id, 'open')}
                      sx={{ cursor: agent.open > 0 ? 'pointer' : 'default', color: '#ff9800', fontWeight: 600 }}
                    >
                      {agent.open}
                    </TableCell>
                    <TableCell
                      align="center"
                      onClick={() => agent.in_progress > 0 && handleAgentStatusClick(agent.agent_id, 'in-progress')}
                      sx={{ cursor: agent.in_progress > 0 ? 'pointer' : 'default', color: '#2196f3', fontWeight: 600 }}
                    >
                      {agent.in_progress}
                    </TableCell>
                    <TableCell
                      align="center"
                      onClick={() => agent.total_active > 0 && handleAgentStatusClick(agent.agent_id, 'active')}
                      sx={{ cursor: agent.total_active > 0 ? 'pointer' : 'default', color: '#f97316', fontWeight: 600 }}
                    >
                      {agent.total_active}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Fade>
  );
};

export default AgentActiveTicketBreakdown;
