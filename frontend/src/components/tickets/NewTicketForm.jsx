import React, { useState, useEffect, useRef } from 'react';
import { ticketService } from '../../services/ticket';
import { getCategories } from '../../services/category';
import { getDepartments } from '../../services/department';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const Card = ({ children, className = '' }) => {
  const { isDark } = useTheme();
  return (
    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-xl shadow-lg border hover:shadow-xl transition-shadow duration-300 ${className}`}>
      {children}
    </div>
  );
};

const NewTicketForm = ({ onSubmit, onCancel }) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    category_id: '',
    attachments: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Constants for file limits
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  const MAX_FILES = 3;
  
  // State for tooltip
  const [tooltipInfo, setTooltipInfo] = useState({
    visible: false,
    content: '',
    title: '',
    x: 0,
    y: 0
  });

  useEffect(() => {
    fetchDepartments();
    fetchCategories();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter categories when department changes
  useEffect(() => {
    if (formData.department_id) {
      const departmentCategories = categories.filter(
        category => category.department_id === parseInt(formData.department_id, 10)
      );
      setFilteredCategories(departmentCategories);
      
      // Reset category selection when department changes
      setFormData(prev => ({
        ...prev,
        category_id: ''
      }));
    } else {
      setFilteredCategories([]);
    }
  }, [formData.department_id, categories]);

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      setError('Failed to load departments');
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      setError('Failed to load categories');
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'attachments' && files?.length > 0) {
      // Convert FileList to Array for easier handling
      const newFiles = Array.from(files);
      
      // Check if adding these files would exceed the maximum
      if (formData.attachments.length + newFiles.length > MAX_FILES) {
        setError(`You can only upload up to ${MAX_FILES} files at a time`);
        return;
      }

      // Check file sizes
      const invalidFiles = newFiles.filter(file => file.size > MAX_FILE_SIZE);
      if (invalidFiles.length > 0) {
        setError('Files must be less than 5MB each');
        return;
      }

      // Add new files to existing ones
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
      setError(null);
      
      // Reset the file input
      e.target.value = '';
    } else if (name === 'category_id' || name === 'department_id') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value, 10) || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleCategorySelect = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      category_id: categoryId
    }));
    setDropdownOpen(false);
  };

  const showTooltip = (e, title, content) => {
    // Prevent the tooltip from going off-screen
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate position to keep tooltip within viewport
    let x = e.clientX + 10; // 10px offset from cursor
    let y = e.clientY - 10;
    
    // Adjust if tooltip would go off right edge
    if (x + 300 > windowWidth) {
      x = windowWidth - 310;
    }
    
    // Adjust if tooltip would go off top edge
    if (y - 100 < 0) {
      y = 110;
    }
    
    setTooltipInfo({
      visible: true,
      content,
      title,
      x,
      y
    });
    
    e.stopPropagation();
  };

  const hideTooltip = () => {
    setTooltipInfo(prev => ({
      ...prev,
      visible: false
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.title || !formData.description || !formData.category_id) {
      setError('Please fill out all required fields.');
      setLoading(false);
      return;
    }

    try {
      const ticketFormData = new FormData();
      ticketFormData.append('title', formData.title);
      ticketFormData.append('description', formData.description);
      ticketFormData.append('category_id', formData.category_id);

      if (formData.attachments.length > 0) {
        formData.attachments.forEach(file => {
          ticketFormData.append('attachments', file);
        });
      }

      await onSubmit(ticketFormData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(error.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (e) => {
    e?.preventDefault(); // Make preventDefault optional in case there's no event
    if (typeof onCancel === 'function') {
      onCancel();
    }
  };

  // Get selected category name
  const selectedCategory = filteredCategories.find(cat => cat.id === formData.category_id);

  return (
    <Card className="max-w-3xl mx-auto">
      <div className="p-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Create New Ticket</h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Please provide details about your issue and we'll help you resolve it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={`rounded-lg ${isDark ? 'bg-red-900 border-red-800' : 'bg-red-50 border-red-100'} p-4 mb-6 border`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className={`h-5 w-5 ${isDark ? 'text-red-500' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-800'}`}>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Title
            </label>
            <input
              type="text"
              name="title"
              id="title"
              required
              value={formData.title}
              onChange={handleChange}
              className={`block w-full px-3 py-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              } shadow-sm sm:text-sm transition-colors duration-200`}
              placeholder="Brief summary of your issue"
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <label htmlFor="department_id" className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Department
            </label>
            <select
              name="department_id"
              id="department_id"
              required
              value={formData.department_id}
              onChange={handleChange}
              className={`block w-full px-2 py-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500' 
                  : 'bg-white border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              } shadow-sm sm:text-sm transition-colors duration-200`}
            >
              <option value="">Select a department</option>
              {departments.map(department => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>

          {/* Category - Custom Dropdown with Info Icons */}
          <div className="space-y-2">
            <label htmlFor="category_id" className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Category
            </label>
            <div className="relative" ref={dropdownRef}>
              {/* Custom dropdown trigger */}
              <button
                type="button"
                onClick={() => formData.department_id && setDropdownOpen(!dropdownOpen)}
                disabled={!formData.department_id}
                className={`block w-full px-3 py-3 rounded-lg border ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-gray-100' 
                    : 'bg-white border-gray-300 text-gray-900'
                } shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-colors duration-200 text-left`}
              >
                {selectedCategory ? selectedCategory.name : formData.department_id ? 'Select a category' : 'Please select a department first'}
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
              
              {/* Hidden input for form validation */}
              <input 
                type="hidden" 
                name="category_id" 
                value={formData.category_id} 
                required 
              />
              
              {/* Dropdown menu */}
              {dropdownOpen && (
              <div className={`absolute z-10 mt-1 w-full ${isDark ? 'bg-gray-800 ring-gray-700' : 'bg-white ring-black ring-opacity-5'} shadow-lg max-h-60 rounded-md py-1 text-base ring-1 overflow-auto focus:outline-none sm:text-sm`}>
                {filteredCategories.length > 0 ? (
                  filteredCategories.map(category => (
                    <div 
                      key={category.id} 
                      className={`cursor-pointer group relative flex justify-between items-center px-4 py-2 ${
                        isDark
                          ? formData.category_id === category.id 
                            ? 'bg-gray-700 text-blue-400' 
                            : 'text-gray-300 hover:bg-gray-700'
                          : formData.category_id === category.id 
                            ? 'bg-indigo-50 text-indigo-900' 
                            : 'hover:bg-gray-100'
                      }`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <span>{category.name}</span>
                      <div className="group relative">
                        {/* Tooltip Trigger */}
                        <div 
                          className={`w-5 h-5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} flex items-center justify-center text-xs cursor-help`}
                          onMouseEnter={(e) => showTooltip(e, category.name, category.description || 'No description available')}
                          onMouseLeave={hideTooltip}
                        >
                          i
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`px-4 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No categories available</div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Description
            </label>
            <textarea
              name="description"
              id="description"
              required
              rows={6}
              value={formData.description}
              onChange={handleChange}
              className={`block w-full px-3 py-3 rounded-lg border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              } shadow-sm sm:text-sm transition-colors duration-200`}
              placeholder="Please provide detailed information about your issue..."
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <label className={`block text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Attachment (Optional)
            </label>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <label className={`inline-flex items-center px-4 py-2 rounded-md cursor-pointer ${
                  isDark 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Files</span>
                  <input
                    type="file"
                    name="attachments"
                    onChange={handleChange}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    multiple
                  />
                </label>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  Select up to {MAX_FILES} files at once, each no larger than 5MB
                </span>
              </div>

              {/* File list */}
              {formData.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {formData.attachments.map((file, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-2 rounded ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
                    >
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className={`p-1 rounded-full hover:bg-opacity-80 ${
                          isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className={`px-6 py-3 border rounded-lg text-sm font-medium ${
                isDark 
                  ? 'border-gray-700 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-lg text-sm font-medium text-white ${
                isDark 
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating...</span>
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* Global tooltip that follows cursor */}
      {tooltipInfo.visible && (
        <div 
          className={`fixed z-[9999] p-3 ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-900 text-white'} text-sm rounded-lg shadow-lg`}
          style={{
            top: `${tooltipInfo.y}px`,
            left: `${tooltipInfo.x}px`,
            width: '16rem',
            pointerEvents: 'none'
          }}
        >
          <p className="font-medium mb-1">{tooltipInfo.title}</p>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-300'} text-xs`}>{tooltipInfo.content}</p>
        </div>
      )}
    </Card>
  );
};

export default NewTicketForm;
