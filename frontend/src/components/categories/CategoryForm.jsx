import React, { useState, useEffect } from 'react';
import { getDepartments } from '../../services/department';
import { userService } from '../../services/user';
import { useTheme } from '../../context/ThemeContext';

const CategoryForm = ({ category, onSubmit, onCancel }) => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    department_id: category?.department_id || '',
    tat_minutes: category?.tat_minutes || 30,
    user_ids: category?.users?.map(u => u.id) || []
  });

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const data = await getDepartments();
        setDepartments(data);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // Fetch all agents regardless of department
        const data = await userService.getUsers({
          role: 'agent'
        });
        setAgents(data);
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };

    fetchAgents();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleAgent = (agentId) => {
    setFormData(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(agentId)
        ? prev.user_ids.filter(id => id !== agentId)
        : [...prev.user_ids, agentId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(formData);
      onCancel();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Name
        </label>
        <input
          type="text"
          name="name"
          id="name"
          value={formData.name}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
              : 'border-gray-300 focus:border-indigo-500'
          }`}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Description
        </label>
        <textarea
          name="description"
          id="description"
          value={formData.description}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
              : 'border-gray-300 focus:border-indigo-500'
          }`}
        />
      </div>

      <div>
        <label htmlFor="department_id" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Department
        </label>
        <select
          name="department_id"
          id="department_id"
          value={formData.department_id}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
              : 'border-gray-300 focus:border-indigo-500'
          }`}
          required
        >
          <option value="">Select a department</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Agents
        </label>
        <div className={`border rounded-md p-3 max-h-64 overflow-y-auto ${
          isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'
        }`}>
          {agents.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No agents available
            </p>
          ) : (
            agents.map(agent => (
              <div
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center p-2 rounded cursor-pointer transition-colors mb-1 ${
                  formData.user_ids.includes(agent.id)
                    ? isDark
                      ? 'bg-indigo-900 bg-opacity-50'
                      : 'bg-indigo-50'
                    : isDark
                    ? 'hover:bg-gray-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`flex items-center justify-center w-5 h-5 mr-3 rounded border ${
                  formData.user_ids.includes(agent.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : isDark
                    ? 'border-gray-500'
                    : 'border-gray-300'
                }`}>
                  {formData.user_ids.includes(agent.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {agent.name}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {agent.email}
                  </p>
                  {agent.user_departments && agent.user_departments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.user_departments.map(ud => (
                        <span
                          key={ud.department.id}
                          className={`text-xs px-2 py-0.5 rounded ${
                            isDark
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {ud.department.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Selected: {formData.user_ids.length} agent(s)
        </p>
      </div>

      <div>
        <label htmlFor="tat_minutes" className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          TAT (hours)
        </label>
        <input
          type="number"
          name="tat_minutes"
          id="tat_minutes"
          value={formData.tat_minutes}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
              : 'border-gray-300 focus:border-indigo-500'
          }`}
          required
          min="1"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            isDark
              ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            loading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default CategoryForm;
