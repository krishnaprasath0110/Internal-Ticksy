import api from './api';

export const getDepartments = async () => {
  const response = await api.get('/departments/');
  return response.data;
};

export const getDepartment = async (id) => {
  const response = await api.get(`/departments/${id}`);
  return response.data;
};

export const createDepartment = async (data) => {
  const response = await api.post('/departments/', data);
  return response.data;
};

export const updateDepartment = async (id, data) => {
  const response = await api.put(`/departments/${id}`, data);
  return response.data;
};

export const deleteDepartment = async (id) => {
  await api.delete(`/departments/${id}`);
};
