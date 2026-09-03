import api from './api';
import { getAuthHeader } from './auth';

class UserService {
  async getUsers(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.role) {
        params.append('role', filters.role);
      }
      if (filters.department_id) {
        params.append('department_id', filters.department_id);
      }
      if (filters.category_id) {
        params.append('category_id', filters.category_id);
      }

      const queryString = params.toString();
      const url = `/users/${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in getUsers:', error);
      throw error.response?.data || error;
    }
  }

  async createAgent(userData) {
    try {
      const response = await api.post('/users/agent', userData, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data.user;
    } catch (error) {
      console.error('Error in createAgent:', error);
      throw error;
    }
  }

  async createCandidate(userData) {
    try {
      const response = await api.post('/users/candidate', userData, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data.user;
    } catch (error) {
      console.error('Error in createCandidate:', error);
      throw error;
    }
  }

  async updateUser(userId, userData) {
    try {
      const response = await api.put(`/users/${userId}`, userData, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error.response?.data || error;
    }
  }

  async deleteUser(userId) {
    try {
      const response = await api.delete(`/users/${userId}`, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error.response?.data || error;
    }
  }

  async updateAgent(userId, userData) {
    try {
      const response = await api.put(`/users/agent/${userId}`, userData, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in updateAgent:', error);
      throw error.response?.data || error;
    }
  }

  async updateCandidate(userId, userData) {
    try {
      const response = await api.put(`/users/candidate/${userId}`, userData, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in updateCandidate:', error);
      throw error.response?.data || error;
    }
  }

  async getRoles() {
    try {
      const response = await api.get('/roles/', {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in getRoles:', error);
      throw error.response?.data || error;
    }
  }

  async getDepartments() {
    try {
      const response = await api.get('/departments/', {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in getDepartments:', error);
      throw error.response?.data || error;
    }
  }

  async getTemplates() {
    try {
      const response = await api.get('/templates/', {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in getTemplates:', error);
      throw error.response?.data || error;
    }
  }

  async getCategories(departmentId = null) {
    try {
      const url = departmentId 
        ? `/categories/?department_id=${departmentId}`
        : '/categories/';
      
      const response = await api.get(url, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error.response?.data || error;
    }
  }

  async importCandidates(formData) {
    try {
      const response = await api.post('/users/bulk-import-candidates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error in importCandidates:', error);
      throw error.response?.data || error;
    }
  }
}

export const userService = new UserService();
