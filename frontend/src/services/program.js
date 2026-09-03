import api from './api';

export const getPrograms = async () => {
  const response = await api.get('/programs/');
  return response.data;
};

export const getProgram = async (id) => {
  const response = await api.get(`/programs/${id}`);
  return response.data;
};

export const createProgram = async (data) => {
  const response = await api.post('/programs/', data);
  return response.data;
};

export const updateProgram = async (id, data) => {
  const response = await api.put(`/programs/${id}`, data);
  return response.data;
};

export const deleteProgram = async (id) => {
  await api.delete(`/programs/${id}`);
};
