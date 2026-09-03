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
  Grid,
} from '@mui/material';
import { dashboardService } from '../../services/dashboard';

const SLA_SECTIONS = [
  {
    key: 'resolution_72h',
    title: 'Resolution SLA – 72 Hours',
    subtitle: 'All categories except Academic Affairs (TAT breach limit 72h)',
    buckets: [
      { key: 'low', label: 'Low', description: 'Less than 36 hours from ticket creation', color: '#22c55e', bgColor: '#ecfdf5' },
      { key: 'medium', label: 'Medium', description: '36–60 hours from ticket creation', color: '#d97706', bgColor: '#fffbeb' },
      { key: 'high', label: 'High', description: '60–72 hours from ticket creation', color: '#f97316', bgColor: '#fff7ed' },
      { key: 'breached', label: 'Breached', description: 'More than 72 hours from ticket creation', color: '#dc2626', bgColor: '#fef2f2' },
    ],
  },
  {
    key: 'academic_affairs_120h',
    title: 'Academic Affairs Resolution SLA – 120 Hours',
    subtitle: 'Academic Affairs categories (TAT breach limit 120h)',
    buckets: [
      { key: 'low', label: 'Low', description: 'Less than 60 hours from ticket creation', color: '#22c55e', bgColor: '#ecfdf5' },
      { key: 'medium', label: 'Medium', description: '60–96 hours from ticket creation', color: '#d97706', bgColor: '#fffbeb' },
      { key: 'high', label: 'High', description: '96–120 hours from ticket creation', color: '#f97316', bgColor: '#fff7ed' },
      { key: 'breached', label: 'Breached', description: 'More than 120 hours from ticket creation', color: '#dc2626', bgColor: '#fef2f2' },
    ],
  },
];

const ClosureSlaHealth = ({ programId = '', batchId = '' }) => {
  const programBatchFilters = { programId, batchId };
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, [programId, batchId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getClosureSlaMetrics(programBatchFilters);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching closure SLA metrics:', err);
      setError(err.detail || 'Failed to load closure SLA metrics');
    } finally {
      setLoading(false);
    }
  };

  const bucketPercentage = (count, total) => {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  };

  const handleClosureSlaClick = (sectionKey, bucketKey, count) => {
    if (!count || count <= 0) return;
    const params = new URLSearchParams({
      status: 'open,in-progress',
      closure_sla: `${sectionKey}:${bucketKey}`,
    });
    if (programId) params.set('program_id', programId);
    if (batchId) params.set('batch_id', batchId);
    navigate(`/tickets?${params.toString()}`);
  };

  if (loading && !metrics) {
    return (
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>SLA Health</Typography>
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

  if (!metrics) return null;

  const SlaBucketCard = ({ label, count, percentage, color, bgColor, description, onClick }) => (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        borderLeft: `4px solid ${color}`,
        bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : bgColor,
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        borderLeftWidth: 4,
        borderLeftColor: color,
        height: '100%',
        cursor: count > 0 ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': count > 0 ? {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        } : {},
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
          {percentage}%
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? '#fff' : '#111827', mb: 0.5 }}>
        {count}
      </Typography>
      <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280', display: 'block', mb: 1, lineHeight: 1.4 }}>
        {description}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: `${color}20`,
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
        }}
      />
    </Box>
  );

  return (
    <Fade in>
      <Card sx={{ borderRadius: 2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)', border: '1px solid #e6e9f0' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#111827' }}>
              SLA Health
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6b7280', mt: 0.5 }}>
              Active tickets approaching or past closure SLA based on category TAT breach limit
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {SLA_SECTIONS.map((section) => {
              const sectionData = metrics[section.key] || {};
              const total = sectionData.total || 0;
              const approaching = (sectionData.high || 0);
              const breached = sectionData.breached || 0;

              return (
                <Grid item xs={12} lg={6} key={section.key}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fafafa',
                      height: '100%',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#111827' }}>
                          {section.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                          {section.subtitle}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${total} Active`}
                          size="small"
                          sx={{ bgcolor: '#6366f1', color: '#fff', fontWeight: 600 }}
                        />
                        {approaching > 0 && (
                          <Chip
                            label={`${approaching} Approaching`}
                            size="small"
                            sx={{ bgcolor: '#f97316', color: '#fff', fontWeight: 600 }}
                          />
                        )}
                        {breached > 0 && (
                          <Chip
                            label={`${breached} Breached`}
                            size="small"
                            sx={{ bgcolor: '#dc2626', color: '#fff', fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </Box>

                    <Grid container spacing={1.5}>
                      {section.buckets.map((bucket) => {
                        const count = sectionData[bucket.key] || 0;
                        return (
                          <Grid item xs={12} sm={6} key={bucket.key}>
                            <SlaBucketCard
                              label={bucket.label}
                              count={count}
                              percentage={bucketPercentage(count, total)}
                              color={bucket.color}
                              bgColor={bucket.bgColor}
                              description={bucket.description}
                              onClick={() => handleClosureSlaClick(section.key, bucket.key, count)}
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>
    </Fade>
  );
};

export default ClosureSlaHealth;
