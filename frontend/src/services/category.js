import api from './api';

export const getCategories = async (departmentId) => {
  const params = departmentId ? { department_id: departmentId } : {};
  const response = await api.get('/categories/', { params });
  return response.data;
};

export const getCategory = async (id) => {
  const response = await api.get(`/categories/${id}`);
  return response.data;
};

export const createCategory = async (data) => {
  const response = await api.post('/categories/', data);
  const category = response.data;
  return category;
};

export const updateCategory = async (id, data) => {
  const response = await api.put(`/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id) => {
  await api.delete(`/categories/${id}`);
};

// export const assignAgentToCategory = async (categoryId, agentId) => {
//   const response = await api.post(`/categories/${categoryId}/agent/${agentId}`);
//   return response.data;
// };

// export const removeAgentFromCategory = async (categoryId) => {
//   await api.delete(`/categories/${categoryId}/agent`);
// };

export const getCategoryAgent = async (categoryId) => {
  try {
    const response = await api.get(`/categories/${categoryId}/agent`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getAgentCategories = async (userId) => {
  const response = await api.get(`/categories/agent/${userId}`);
  return response.data;
};