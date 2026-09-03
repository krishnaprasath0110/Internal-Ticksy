import api from './api';

export const createThread = async (ticketId, formData) => {
  try {
    const response = await api.post(`/tickets/${ticketId}/threads`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getThreadsByTicket = async (ticketId) => {
  try {
    const response = await api.get(`/tickets/${ticketId}/threads`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getThreadById = async (ticketId, threadId) => {
  try {
    const response = await api.get(`/tickets/${ticketId}/threads/${threadId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
