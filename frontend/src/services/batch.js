import api from './api';

export const getBatches = async () => {
  const response = await api.get('/batches/');
  return response.data;
};

export const getBatch = async (id) => {
  const response = await api.get(`/batches/${id}`);
  return response.data;
};

export const createBatch = async (data) => {
  const response = await api.post('/batches/', data);
  return response.data;
};

export const updateBatch = async (id, data) => {
  const response = await api.put(`/batches/${id}`, data);
  return response.data;
};

export const deleteBatch = async (id) => {
  await api.delete(`/batches/${id}`);
};

// FAQ Management
export const uploadFaqFile = async (batchId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(`/batches/${batchId}/faq/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getBatchFaqs = async (batchId) => {
  const response = await api.get(`/batches/${batchId}/faq`);
  return response.data;
};

export const getBatchFaqStatus = async (batchId) => {
  const response = await api.get(`/batches/${batchId}/faq/status`);
  return response.data;
};

export const deleteBatchFaqs = async (batchId) => {
  const response = await api.delete(`/batches/${batchId}/faq`);
  return response.data;
};
