import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  useTheme
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  Block,
  Schedule
} from '@mui/icons-material';

const AgentMetrics = ({ agent, tickets = [], categoryBreakdown = [] }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDarkMode = theme.palette.mode === 'dark';

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : '#e6e9f0';
  const bgSecondary = isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8f9fc';
  const textPrimary = isDarkMode ? '#fff' : '#1a1e2e';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.7)' : '#4a5068';
  const textMuted = isDarkMode ? 'rgba(255,255,255,0.5)' : '#8b92aa';

  const calculatePercentage = (value, total) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  const statusConfig = [
    { key: 'open', label: 'Open', color: '#d97706', bgColor: '#fffbeb', icon: <Error sx={{ fontSize: 10 }} /> },
    { key: 'in_progress', label: 'In Progress', color: '#0891b2', bgColor: '#ecfeff', icon: <HourglassEmpty sx={{ fontSize: 10 }} /> },
    { key: 'closed', label: 'Closed', color: '#059669', bgColor: '#ecfdf5', icon: <CheckCircle sx={{ fontSize: 10 }} /> },
    { key: 'not_applicable', label: 'Not Applicable', color: '#8b92aa', bgColor: '#f1f3f8', icon: <Block sx={{ fontSize: 10 }} /> },
    { key: 'delayed', label: 'Delayed', color: '#dc2626', bgColor: '#fef2f2', icon: <Schedule sx={{ fontSize: 10 }} /> },
  ];

  if (!agent) {
    return null;
  }

  const handleOpenMetricClick = (status) => {
    const statusLower = status ? status.toLowerCase().replace(' ', '-') : '';
    navigate(`/tickets?status=${statusLower}&agent_id=${agent.id}`);
  };

  const handleDelayedClick = () => {
    navigate(`/tickets?delayed=true&agent_id=${agent.id}`);
  };

  const getStatusValue = (status) => {
    if (!status) return '';
    if (typeof status === 'string') return status.toLowerCase();
    if (typeof status === 'object' && status.name) return status.name.toLowerCase();
    return '';
  };

  const ticketCounts = {
    open: tickets.filter(t => getStatusValue(t.status) === 'open').length,
    in_progress: tickets.filter(t => getStatusValue(t.status) === 'in-progress').length,
    closed: tickets.filter(t => getStatusValue(t.status) === 'closed').length,
    not_applicable: tickets.filter(t => getStatusValue(t.status) === 'not-applicable').length,
    delayed: tickets.filter(t => t.is_delayed === true).length,
  };

  const totalTickets = tickets.length;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1px solid ${borderColor}` }}>
        {[
          { label: 'Total Tickets', value: totalTickets, color: '#2563eb', bgColor: '#eff4ff', status: null, isDelayed: false },
          { label: 'Open Tickets', value: ticketCounts.open, color: '#d97706', bgColor: '#fffbeb', status: 'Open', isDelayed: false },
          { label: 'In Progress', value: ticketCounts.in_progress, color: '#0891b2', bgColor: '#ecfeff', status: 'In Progress', isDelayed: false },
          { label: 'Closed', value: ticketCounts.closed, color: '#059669', bgColor: '#ecfdf5', status: 'Closed', isDelayed: false },
          { label: 'Delayed', value: ticketCounts.delayed, color: '#dc2626', bgColor: '#fef2f2', status: null, isDelayed: true },
        ].map((stat, idx) => {
          const pct = calculatePercentage(stat.value, totalTickets || 0);
          const isClickable = (stat.status !== null || stat.isDelayed) && stat.value > 0;
          const handleClick = () => {
            if (stat.isDelayed) {
              handleDelayedClick();
            } else if (stat.status) {
              handleOpenMetricClick(stat.status);
            }
          };
          return (
            <Box 
              key={idx} 
              onClick={() => isClickable && handleClick()}
              sx={{ 
                p: '14px 16px', 
                borderRight: idx < 4 ? `1px solid ${borderColor}` : 'none',
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s',
                '&:hover': isClickable ? { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5' } : {}
              }}
            >
              <Typography sx={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: textMuted, mb: '3px' }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-1px', color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '10px', color: textMuted, mt: '1px' }}>
                {pct}% of total
              </Typography>
              <Box sx={{ height: '3px', borderRadius: '3px', mt: '5px', bgcolor: stat.bgColor }}>
                <Box sx={{ height: '3px', width: `${pct}%`, bgcolor: stat.color, borderRadius: '3px', transition: 'width 1s ease' }} />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ p: '16px 20px', mt: '12px' }}>
        <Typography sx={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '13px', fontWeight: 700, color: textPrimary, mb: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          📂 Category Breakdown
        </Typography>
        {!categoryBreakdown || categoryBreakdown.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: '40px 20px', color: textMuted, gap: '8px', fontSize: '12.5px' }}>
            <Typography sx={{ fontSize: '28px', opacity: 0.25 }}>📂</Typography>
            <Typography sx={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '15px', fontWeight: 600, color: textSecondary }}>
              No category data
            </Typography>
            <Typography>This agent has no category breakdown available.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {categoryBreakdown.map((category, idx) => {
              const maxValue = Math.max(
                category.open || 0,
                category.in_progress || 0,
                category.closed || 0,
                category.not_applicable || 0,
                category.delayed || 0,
                1
              );
              const categoryTotal = (category.open || 0) + (category.in_progress || 0) + (category.closed || 0) + (category.not_applicable || 0);

              return (
                <Box key={idx} sx={{ bgcolor: bgSecondary, border: `1px solid ${borderColor}`, borderRadius: '10px', p: '14px 15px', cursor: 'pointer', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '12px' }}>
                    <Box>
                      <Typography sx={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '12.5px', fontWeight: 700, color: textPrimary, lineHeight: 1.35 }}>
                        {category.name || 'Unnamed Category'}
                      </Typography>
                      <Typography sx={{ fontSize: '10.5px', color: textMuted, mt: '2px' }}>
                        {category.department_name || category.department || 'No department'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '18px', fontWeight: 800, color: '#2563eb', flexShrink: 0, ml: '8px' }}>
                      {categoryTotal}
                    </Typography>
                  </Box>
                  {statusConfig.map((status) => {
                    const value = category[status.key] || 0;
                    const pct = calculatePercentage(value, maxValue);
                    const totalPct = calculatePercentage(value, categoryTotal || 0);
                    return (
                      <Box key={status.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '7px', '&:last-child': { mb: 0 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: textSecondary, minWidth: '100px' }}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: status.bgColor, color: status.color, flexShrink: 0 }}>
                            {status.icon}
                          </Box>
                          {status.label}
                        </Box>
                        <Box sx={{ flex: 1, height: '3px', bgcolor: borderColor, borderRadius: '3px', overflow: 'hidden', mx: '8px' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: status.color, borderRadius: '3px' }} />
                        </Box>
                        <Typography sx={{ fontSize: '11px', fontWeight: 700, minWidth: '60px', textAlign: 'right', color: value > 0 ? status.color : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#c5cad8') }}>
                          {value} <Typography component="span" sx={{ fontSize: '9.5px', color: textMuted }}>({totalPct}%)</Typography>
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AgentMetrics;
