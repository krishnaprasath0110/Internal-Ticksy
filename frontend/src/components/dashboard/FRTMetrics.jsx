import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar
} from '@mui/material';
import {
  AccessTime,
  CheckCircle,
  HourglassEmpty,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { ticketService } from '../../services/ticket';

const FRTMetrics = ({ programId = '', batchId = '' }) => {
  const programBatchFilters = { programId, batchId };
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [overallFRT, setOverallFRT] = useState(null);
  const [agentFRT, setAgentFRT] = useState([]);
  const [loading, setLoading] = useState(true);

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : '#e6e9f0';
  const bgSecondary = isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8f9fc';
  const textPrimary = isDarkMode ? '#fff' : '#1a1e2e';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.7)' : '#4a5068';
  const textMuted = isDarkMode ? 'rgba(255,255,255,0.5)' : '#8b92aa';

  useEffect(() => {
    fetchFRTMetrics();
  }, [programId, batchId]);

  const fetchFRTMetrics = async () => {
    try {
      setLoading(true);
      const [overall, agents] = await Promise.all([
        ticketService.getOverallFRT(programBatchFilters),
        ticketService.getAgentFRT(programBatchFilters)
      ]);
      setOverallFRT(overall);
      
      // Filter to show only active agents (those with tickets) and sort by average FRT descending
      const activeAgents = agents
        .filter(agent => agent.total_tickets > 0)
        .sort((a, b) => b.average_frt_hours - a.average_frt_hours);
      
      setAgentFRT(activeAgents);
    } catch (error) {
      console.error('Error fetching FRT metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getPerformanceColor = (hours) => {
    if (hours <= 2) return '#059669'; // Green - Excellent
    if (hours <= 8) return '#0891b2'; // Teal - Good
    if (hours <= 24) return '#d97706'; // Amber - Average
    return '#dc2626'; // Red - Needs improvement
  };

  if (loading) {
    return (
      <Card sx={{ borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)', border: `1px solid ${borderColor}` }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <LinearProgress sx={{ width: '200px' }} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)', border: `1px solid ${borderColor}`, overflow: 'hidden', maxHeight: '600px' }}>
      {/* Header */}
      <Box sx={{ p: '16px 22px', borderBottom: `1px solid ${borderColor}`, bgcolor: bgSecondary }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-0.2px',
                color: textPrimary
              }}
            >
              ⏱️ First Response Time (FRT) Analysis
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: '11.5px',
                color: textMuted,
                mt: '2px'
              }}
            >
              Average time taken to respond to tickets
            </Typography>
          </Box>
        </Box>
      </Box>

      <CardContent sx={{ p: 0 }}>
        <Grid container>
          {/* Overall FRT Section */}
          <Grid item xs={12} md={4} sx={{ borderRight: { md: `1px solid ${borderColor}` }, p: '20px' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: textMuted, mb: '12px' }}>
              Overall Performance
            </Typography>
            
            {overallFRT && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mb: '6px' }}>
                    <Typography
                      sx={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: '36px',
                        fontWeight: 800,
                        letterSpacing: '-1.5px',
                        color: getPerformanceColor(overallFRT.average_frt_hours)
                      }}
                    >
                      {formatHours(overallFRT.average_frt_hours)}
                    </Typography>
                    <Typography sx={{ fontSize: '13px', color: textMuted, mb: '4px' }}>
                      avg response time
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle sx={{ fontSize: 14, color: '#059669' }} />
                      <Typography sx={{ fontSize: '12px', color: textSecondary }}>Responded</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                      {overallFRT.responded_tickets} / {overallFRT.total_tickets}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HourglassEmpty sx={{ fontSize: 14, color: '#d97706' }} />
                      <Typography sx={{ fontSize: '12px', color: textSecondary }}>Pending</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                      {overallFRT.pending_tickets}
                    </Typography>
                  </Box>

                  <Box sx={{ height: '3px', borderRadius: '3px', bgcolor: borderColor, mt: '4px' }}>
                    <Box 
                      sx={{ 
                        height: '100%', 
                        width: `${(overallFRT.responded_tickets / overallFRT.total_tickets) * 100}%`, 
                        bgcolor: '#059669', 
                        borderRadius: '3px',
                        transition: 'width 1s ease'
                      }} 
                    />
                  </Box>
                </Box>
              </>
            )}
          </Grid>

          {/* Agent-wise FRT Table */}
          <Grid item xs={12} md={8}>
            <Box sx={{ p: '16px 20px', overflowY: 'auto', maxHeight: '400px' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: textMuted, mb: '12px' }}>
                Agent Performance
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', border: 'none', pb: '8px' }}>
                        Agent
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '10.5px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', border: 'none', pb: '8px' }}>
                        Avg FRT
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '10.5px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', border: 'none', pb: '8px' }}>
                        Tickets Responded
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agentFRT.map((agent, index) => {
                      const responseRate = (agent.responded_tickets / agent.total_tickets) * 100;
                      return (
                        <TableRow 
                          key={agent.agent_id}
                          sx={{ 
                            '&:hover': { bgcolor: bgSecondary },
                            borderBottom: index < agentFRT.length - 1 ? `1px solid ${borderColor}` : 'none'
                          }}
                        >
                          <TableCell sx={{ border: 'none', py: '10px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  bgcolor: `hsl(${(agent.agent_id * 137.5) % 360}, 70%, 60%)`
                                }}
                              >
                                {getInitials(agent.agent_name)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: textPrimary, lineHeight: 1.3 }}>
                                  {agent.agent_name}
                                </Typography>
                                <Typography sx={{ fontSize: '10px', color: textMuted }}>
                                  {agent.agent_email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={{ border: 'none', py: '10px' }}>
                            <Chip
                              label={formatHours(agent.average_frt_hours)}
                              sx={{
                                bgcolor: `${getPerformanceColor(agent.average_frt_hours)}15`,
                                color: getPerformanceColor(agent.average_frt_hours),
                                fontWeight: 700,
                                fontSize: '11px',
                                height: '24px',
                                fontFamily: "'Bricolage Grotesque', sans-serif"
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ border: 'none', py: '10px' }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: textSecondary }}>
                              {agent.total_tickets}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {agentFRT.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4, color: textMuted }}>
                  <Typography sx={{ fontSize: '12px' }}>No agent data available</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default FRTMetrics;
