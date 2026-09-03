import api from './api';
import { getAuthHeader } from './auth';

export const getUniversities = async () => {
  const response = await api.get('/universities/',
    {
      headers: {
        ...getAuthHeader()
      }
    }
  );
  return response.data;
};

export const getUniversity = async (id) => {
  const response = await api.get(`/universities/${id}`,
    {
      headers: {
        ...getAuthHeader()
      }
    }
  );
  return response.data;
};

export const createUniversity = async (data) => {
  const response = await api.post('/universities/', data,
    {
      headers: {
        ...getAuthHeader()
      }
    }
  );
  return response.data;
};

export const updateUniversity = async (id, data) => {
  const response = await api.put(`/universities/${id}`, data,
    {
      headers: {
        ...getAuthHeader()
      }
    }
  );
  return response.data;
};

export const deleteUniversity = async (id) => {
  await api.delete(`/universities/${id}`,
    {
      headers: {
        ...getAuthHeader()
      }
    }
  );
};
