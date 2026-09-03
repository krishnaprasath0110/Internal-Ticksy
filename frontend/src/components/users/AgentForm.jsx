import React, { useState, useEffect } from 'react';
import { userService } from '../../services/user';
import { getBatches } from '../../services/batch';
import { toast } from 'react-toastify';
import { useTheme } from '../../context/ThemeContext';

const AgentForm = ({ user, agents, setAgents, onSubmit, onClose }) => {
  const { isDark } = useTheme();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role_id: user?.role_id || '',
    template_id: user?.template_id || user?.template?.id || '',
    department_ids: user?.user_departments?.map(ud => ud.department.id) || [],
    category_ids: user?.user_categories?.map(uc => uc.category.id) || [],
    batch_ids: user?.user_batches?.map(ub => ub.batch.id) || [],
    is_active: user?.is_active ?? true
  });

  const [roles, setRoles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [rolesData, templatesData, departmentsData, categoriesData, batchesData] = await Promise.all([
          userService.getRoles(),
          userService.getTemplates(),
          userService.getDepartments(),
          userService.getCategories(),
          getBatches()
        ]);
        setRoles(rolesData);
        setTemplates(templatesData);
        setDepartments(departmentsData);
        setCategories(categoriesData);
        setBatches(batchesData);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'template_id' && value) {
      const selectedTemplate = templates.find(template => template.id === Number(value));
      if (selectedTemplate) {
        setFormData(prev => ({
          ...prev,
          template_id: value,
          department_ids: selectedTemplate.departments?.map(department => department.id) || [],
          category_ids: selectedTemplate.categories?.map(category => category.id) || [],
          batch_ids: selectedTemplate.batches?.map(batch => batch.id) || []
        }));
        return;
      }
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleSelection = (field, id) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter(selectedId => selectedId !== id)
        : [...prev[field], id]
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.department_ids.length === 0) {
      toast.error('Please select at least one department');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Format the data properly
      const submitData = {
        name: formData.name,
        email: formData.email,
        role_id: parseInt(formData.role_id),
        template_id: formData.template_id ? parseInt(formData.template_id) : null,
        department_ids: formData.department_ids,
        category_ids: formData.category_ids,
        batch_ids: formData.batch_ids,
        is_active: formData.is_active
      };
      
      let response;
      if (user) {
        // Update existing agent
        response = await userService.updateAgent(user.id, submitData);
        toast.success('Agent updated successfully!');
      } else {
        // Create new agent
        response = await userService.createAgent(submitData);
        toast.success('Agent created successfully! Credentials have been sent via email.');
      }
      
      // Only update state if we got a valid response
      if (response) {
        setSuccess(true);
        
        // Update agents list
        if (setAgents && agents) {
          if (user) {
            // Update existing agent in list
            setAgents(prevAgents => 
              prevAgents.map(a => a.id === user.id ? response : a)
            );
          } else {
            // Add new agent to list
            setAgents(prevAgents => [...prevAgents, response.user || response]);
          }
        }
        
        // Close form after delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error('Invalid response from server');
      }
      
    } catch (err) {
      console.error('Error saving agent:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save agent';
      toast.error(errorMessage);
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity" 
          onClick={onClose}
        >
          <div className={`absolute inset-0 ${isDark ? 'bg-black opacity-75' : 'bg-gray-500 opacity-75'}`}></div>
        </div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>

        <div className={`inline-block transform overflow-hidden rounded-lg text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {user ? 'Edit Agent' : 'Add New Agent'}
              </h3>
              <button
                onClick={onClose}
                className={`text-2xl font-semibold ${
                  isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
                }`}
              >
                ×
              </button>
            </div>

            {loading && !success ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className={`mb-4 text-3xl ${isDark ? 'text-green-400' : 'text-green-500'}`}>✓</div>
                <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {user ? 'Agent Updated Successfully' : 'Agent Created Successfully'}
                </p>
                {!user && (
                  <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Credentials have been sent via email
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={`mt-1 block w-full rounded-md px-4 py-3 shadow-sm transition-colors ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="Enter agent's name"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={!!user}
                    className={`mt-1 block w-full rounded-md px-4 py-3 shadow-sm transition-colors ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    } ${user ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Enter email address"
                  />
                  {user && (
                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Email cannot be changed
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Role
                  </label>
                  <select
                    name="role_id"
                    value={formData.role_id}
                    onChange={handleChange}
                    required
                    className={`mt-1 block w-full rounded-md px-4 py-3 shadow-sm transition-colors ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">Select a role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Template
                  </label>
                  <select
                    name="template_id"
                    value={formData.template_id}
                    onChange={handleChange}
                    required
                    className={`mt-1 block w-full rounded-md px-4 py-3 shadow-sm transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">Select a template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  {formData.template_id && (
                    <div className={`mt-2 rounded-md border p-3 text-sm ${isDark ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                      {(() => {
                        const selected = templates.find(t => t.id === Number(formData.template_id));
                        if (!selected) return 'Template selected';
                        return (
                          <div>
                            <div className="font-medium">{selected.name}</div>
                            <div className="mt-1">Departments: {selected.departments?.length || 0} · Categories: {selected.categories?.length || 0} · Batches: {selected.batches?.length || 0}</div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {[
                  { label: 'Departments', field: 'department_ids', items: departments },
                  { label: 'Categories', field: 'category_ids', items: categories },
                  { label: 'Batches', field: 'batch_ids', items: batches }
                ].map(({ label, field, items }) => (
                  <div key={field}>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {label}{field === 'department_ids' ? ' *' : ''}
                    </label>
                    <div className={`border rounded-md p-3 max-h-48 overflow-y-auto ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'}`}>
                      {items.length === 0 ? (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No {label.toLowerCase()} available</p>
                      ) : items.map(item => (
                        <label key={item.id} className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                          formData[field].includes(item.id)
                            ? isDark ? 'bg-blue-900 bg-opacity-50' : 'bg-blue-50'
                            : isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={formData[field].includes(item.id)}
                            onChange={() => toggleSelection(field, item.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                          <span className={`ml-3 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Selected: {formData[field].length}
                    </p>
                  </div>
                ))}

                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                )}
              </form>
            )}
          </div>

          {!success && (
            <div className={`px-6 py-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  onClick={handleFormSubmit}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                    loading
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (user ? 'Updating...' : 'Creating...') : (user ? 'Update Agent' : 'Create Agent')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentForm;
