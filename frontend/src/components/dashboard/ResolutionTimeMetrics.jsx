import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  useTheme,
  Fade,
} from '@mui/material';
import { dashboardService } from '../../services/dashboard';

const FRT_BUCKETS = [
  {
    key: 'frt_low',
    label: 'Low',
    description: 'Less than 12 hours without first response',
    color: '#22c55e',
    bgColor: '#ecfdf5',
  },
  {
    key: 'frt_medium',
    label: 'Medium',
    description: '12–20 hours without first response',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
  {
    key: 'frt_high',
    label: 'High',
    description: '20–24 hours without first response',
    color: '#f97316',
    bgColor: '#fff7ed',
  },
  {
    key: 'frt_breached',
    label: 'Breached',
    description: 'More than 24 hours without first response',
    color: '#dc2626',
    bgColor: '#fef2f2',
  },
];

const ResolutionTimeMetrics = ({ programId = '', batchId = '' }) => {
  const programBatchFilters = { programId, batchId };
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [openMetrics, setOpenMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOpenMetrics();
  }, [programId, batchId]);

  const fetchOpenMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getOpenTicketAgeingMetrics(null, null, programBatchFilters);
      setOpenMetrics(data);
    } catch (err) {
      console.error('Error fetching open ticket ageing metrics:', err);
      setError('Failed to load ticket analysis metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = (status) => {
    const params = new URLSearchParams();
    if (status === 'open') params.set('status', 'open');
    else if (status === 'in-progress') params.set('status', 'in-progress');
    else params.set('status', 'open,in-progress');
    if (programId) params.set('program_id', programId);
    if (batchId) params.set('batch_id', batchId);
    navigate(`/tickets?${params.toString()}`);
  };

  const handleFrtBucketClick = (bucketKey) => {
    const count = openMetrics?.[bucketKey] || 0;
    if (count <= 0) return;
    const bucket = bucketKey.replace('frt_', '');
    const params = new URLSearchParams({
      status: 'open,in-progress',
      frt_bucket: bucket,
    });
    if (programId) params.set('program_id', programId);
    if (batchId) params.set('batch_id', batchId);
    navigate(`/tickets?${params.toString()}`);
  };

  const frtPercentage = (count) => {
    const total = openMetrics?.total_active || 0;
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  if (loading && !openMetrics) {
    return (
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Open Ticket Analysis</Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Typography variant="h6" color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!openMetrics) return null;

  return (
    <Fade in>
      <Card
        sx={{
          borderRadius: 2,
          boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
          border: '1px solid #e6e9f0',
          maxHeight: 320,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CardContent sx={{ p: 3, pb: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#111827' }}>
              Open Ticket Analysis
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`${openMetrics.open} Open`}
                onClick={() => openMetrics.open > 0 && handleStatusClick('open')}
                sx={{ bgcolor: '#ff9800', color: '#fff', fontWeight: 600, cursor: openMetrics.open > 0 ? 'pointer' : 'default' }}
              />
              <Chip
                label={`${openMetrics.in_progress} In Progress`}
                onClick={() => openMetrics.in_progress > 0 && handleStatusClick('in-progress')}
                sx={{ bgcolor: '#2196f3', color: '#fff', fontWeight: 600, cursor: openMetrics.in_progress > 0 ? 'pointer' : 'default' }}
              />
              <Chip
                label={`${openMetrics.total_active} Total Active`}
                onClick={() => openMetrics.total_active > 0 && handleStatusClick('active')}
                sx={{ bgcolor: '#f97316', color: '#fff', fontWeight: 600, cursor: openMetrics.total_active > 0 ? 'pointer' : 'default' }}
              />
            </Box>
          </Box>
        </CardContent>

        <Box
          sx={{
            px: 3,
            pb: 3,
            overflowY: 'auto',
            flex: 1,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': { background: isDarkMode ? 'rgba(255,255,255,0.3)' : '#8b92aa', borderRadius: '3px' },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#111827', mb: 1.5 }}>
            First Response Time (FRT)
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {FRT_BUCKETS.map((bucket) => {
              const count = openMetrics[bucket.key] || 0;
              const pct = frtPercentage(count);
              return (
                <Box
                  key={bucket.key}
                  onClick={() => handleFrtBucketClick(bucket.key)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderLeft: `4px solid ${bucket.color}`,
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : bucket.bgColor,
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
                    borderLeftWidth: 4,
                    borderLeftColor: bucket.color,
                    cursor: count > 0 ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    '&:hover': count > 0 ? {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    } : {},
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: bucket.color }}>
                      {bucket.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
                      {pct}%
                    </Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: isDarkMode ? '#fff' : '#111827', mb: 0.5 }}>
                    {count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280', display: 'block', mb: 1, lineHeight: 1.4 }}>
                    {bucket.description}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: `${bucket.color}20`,
                      '& .MuiLinearProgress-bar': { bgcolor: bucket.color, borderRadius: 2 },
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Card>
    </Fade>
  );
};

export default ResolutionTimeMetrics;
