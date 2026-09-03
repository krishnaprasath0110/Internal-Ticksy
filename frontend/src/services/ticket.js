import { API_URL } from '../config';
import { getAuthHeader } from './auth';
import api from './api';

const getTickets = async (params = {}) => {
  try {
    const response = await api.get('/tickets/', {
      headers: {
        ...getAuthHeader()
      },
      params: params
    });
    return response.data;
  } catch (error) {
    console.error('Error in getTickets:', error);
    throw error.response?.data || error;
  }
}

const getTicketsPaginated = async (params = {}) => {
  try {
    const response = await api.get('/tickets/paginated', {
      headers: {
        ...getAuthHeader()
      },
      params: params
    });
    return response.data;
  } catch (error) {
    console.error('Error in getTicketsPaginated:', error);
    throw error.response?.data || error;
  }
}

const createTicket = async (ticketData) => {
  try {
    const response = await api.post('/tickets/', ticketData, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': undefined, 
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error in createTicket:', error);
    throw error.response?.data || error;
  }
}

const updateTicket = async (ticketId, updateData) => {
  try {
    const response = await api.put(`/tickets/${ticketId}`, updateData, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in updateTicket:', error);
    throw error.response?.data || error;
  }
}

const getTicketById = async (ticketId) => {
  try {
    const response = await api.get(`/tickets/${ticketId}`, {
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in getTicketById:', error);
    throw error.response?.data || error;
  }
}

const reassignTicket = async (ticketId, categoryId) => {
  try {
    const response = await api.put(`/tickets/${ticketId}/reassign/${categoryId}`, {}, {
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in reassignTicket:', error);
    throw error.response?.data || error;
  }
}

const updateTicketStatus = async (ticketId, statusId, closing_reason = null) => {
  try {
    const response = await api.put(`/tickets/${ticketId}/status`, 
      { 
        status_id: statusId,
        closing_reason: closing_reason 
      },  
      {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error in updateTicketStatus:', error);
    throw error.response?.data || error;
  }
}

/**
 * Get all agents for a specific category (for manual assignment)
 * @param {number} categoryId - The ID of the category
 * @returns {Promise<Array>} List of agents with their batch information
 */
const getAgentsByCategory = async (categoryId) => {
  try {
    const response = await api.get(`/tickets/category/${categoryId}/agents`, {
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in getAgentsByCategory:', error);
    throw error.response?.data || error;
  }
}

/**
 * Manually assign a ticket to a specific agent
 * @param {number} ticketId - The ID of the ticket
 * @param {number} agentId - The ID of the agent to assign
 * @returns {Promise<Object>} Updated ticket data
 */
const assignTicketToAgent = async (ticketId, agentId) => {
  try {
    const response = await api.put(`/tickets/${ticketId}/assign-agent/${agentId}`, {}, {
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in assignTicketToAgent:', error);
    throw error.response?.data || error;
  }
}

/**
 * Get agent dashboard data including category-wise ticket breakdown
 * @param {number} agentId - The ID of the agent
 * @returns {Promise<Object>} - Agent dashboard data with tickets and category breakdown
 */
const getAgentDashboard = async (agentId, filters = {}) => {
  try {
    const params = {};
    if (filters.programId) params.program_id = Number(filters.programId);
    if (filters.batchId) params.batch_id = Number(filters.batchId);
    const response = await api.get(`/tickets/agent/${agentId}/dashboard`, { params });
    return response.data;
  } catch (error) {
    console.error('Error in getAgentDashboard:', error);
    throw error.response?.data || error;
  }
};

/**
 * Update ticket priority (internal users only)
 * @param {number} ticketId - The ID of the ticket
 * @param {string} priority - Priority: 'high', 'medium', or 'low'
 * @returns {Promise<Object>} - Updated ticket data
 */
const updateTicketPriority = async (ticketId, priority) => {
  try {
    const response = await api.put(`/tickets/${ticketId}/priority`, 
      { priority },
      {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error in updateTicketPriority:', error);
    throw error.response?.data || error;
  }
};

const updateTicketIssueClassification = async (ticketId, issueTypeId, dispositionId) => {
  try {
    const response = await api.put(
      `/tickets/${ticketId}/issue-classification`,
      {
        issue_type_id: issueTypeId || null,
        disposition_id: dispositionId || null
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error in updateTicketIssueClassification:', error);
    throw error.response?.data || error;
  }
};

const getOverallFRT = async (filters = {}) => {
  try {
    const params = {};
    if (filters.programId) params.program_id = filters.programId;
    if (filters.batchId) params.batch_id = filters.batchId;
    const response = await api.get('/tickets/frt/overall', {
      params,
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in getOverallFRT:', error);
    throw error.response?.data || error;
  }
};

const getAgentFRT = async (filters = {}) => {
  try {
    const params = {};
    if (filters.programId) params.program_id = filters.programId;
    if (filters.batchId) params.batch_id = filters.batchId;
    const response = await api.get('/tickets/frt/agents', {
      params,
      headers: {
        ...getAuthHeader()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error in getAgentFRT:', error);
    throw error.response?.data || error;
  }
};

export const ticketService = {
  createTicket,
  getTickets,
  getTicketsPaginated,
  getTicketById,
  updateTicketStatus,
  reassignTicket,
  updateTicket,
  getAgentDashboard,
  getAgentsByCategory,
  assignTicketToAgent,
  updateTicketPriority,
  updateTicketIssueClassification,
  getOverallFRT,
  getAgentFRT
};
