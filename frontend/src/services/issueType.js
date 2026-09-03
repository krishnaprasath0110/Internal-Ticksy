import api from './api';

export const getIssueTypes = async () => {
  const response = await api.get('/issue-types/');
  return response.data;
};

export const getDispositions = async (issueTypeId) => {
  const response = await api.get(`/issue-types/${issueTypeId}/dispositions`);
  return response.data;
};

export const issueTypeService = {
  getIssueTypes,
  getDispositions,
};

