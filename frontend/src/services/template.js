import api from './api';
import { getAuthHeader } from './auth';

export const getTemplates = async () => {
  const response = await api.get('/templates/', {
    headers: { ...getAuthHeader() }
  });
  return response.data;
};

export const createTemplate = async (data) => {
  const response = await api.post('/templates/', data, {
    headers: { ...getAuthHeader() }
  });
  return response.data;
};

export const updateTemplate = async (id, data) => {
  const response = await api.put(`/templates/${id}`, data, {
    headers: { ...getAuthHeader() }
  });
  return response.data;
};

export const deleteTemplate = async (id) => {
  await api.delete(`/templates/${id}`, {
    headers: { ...getAuthHeader() }
  });
};
