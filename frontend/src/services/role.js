import api from './api';

export const getRoles = async () => {
    try {
        const response = await api.get('/roles/');
        // console.log(response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching roles:', error);
        throw error.response?.data || error;
    }
};
