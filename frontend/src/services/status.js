import api from './api';

export const getStatus = async () => {
    try {
        const response = await api.get('/statuses/');
        return response.data;
    } catch (error) {
        console.error('Error fetching status:', error);
        throw error.response?.data || error;
    }
};