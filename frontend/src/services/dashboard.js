import api from './api';

const appendProgramBatchParams = (params, filters = {}) => {
  const { programId, batchId } = filters;
  if (programId) params.program_id = Number(programId);
  if (batchId) params.batch_id = Number(batchId);
  return params;
};

const buildParams = (startDate, endDate, filters = {}) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return appendProgramBatchParams(params, filters);
};

/**
 * Get dashboard overview with all metrics
 * @returns {Promise<Object>} - Dashboard overview data
 */
export const getDashboardOverview = async () => {
  try {
    const response = await api.get('/dashboard/overview');
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get resolution time metrics for closed tickets
 */
export const getResolutionTimeMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/resolution-time', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching resolution time metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get agent-wise resolution time metrics for closed tickets
 */
export const getAgentResolutionTimeMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/resolution-time/agents', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching agent resolution time metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get open ticket ageing metrics
 */
export const getOpenTicketAgeingMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/open-ticket-ageing', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching open ticket ageing metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get agent-wise open ticket ageing metrics
 */
export const getAgentOpenTicketAgeingMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/open-ticket-ageing/agents', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching agent open ticket ageing metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get priority metrics for tickets
 */
export const getPriorityMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/priority-metrics', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching priority metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get agent-wise priority metrics
 */
export const getAgentPriorityMetrics = async (
  startDate = null,
  endDate = null,
  filters = {}
) => {
  try {
    const response = await api.get('/dashboard/priority-metrics/agents', {
      params: buildParams(startDate, endDate, filters),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching agent priority metrics:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get ticket counts by status using SQL aggregates (fast dashboard loading)
 * @param {Object} filters - Optional { programId, batchId }
 */
export const getDashboardTicketCounts = async (filters = {}) => {
  try {
    const params = appendProgramBatchParams({}, filters);
    const response = await api.get('/dashboard/ticket-counts', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard ticket counts:', error);
    throw error.response?.data || error;
  }
};

export const getClosureSlaMetrics = async (filters = {}) => {
  try {
    const params = appendProgramBatchParams({}, filters);
    const response = await api.get('/dashboard/closure-sla', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching closure SLA metrics:', error);
    throw error.response?.data || error;
  }
};

export const dashboardService = {
  getDashboardOverview,
  getDashboardTicketCounts,
  getResolutionTimeMetrics,
  getAgentResolutionTimeMetrics,
  getOpenTicketAgeingMetrics,
  getAgentOpenTicketAgeingMetrics,
  getPriorityMetrics,
  getAgentPriorityMetrics,
  getClosureSlaMetrics,
};
