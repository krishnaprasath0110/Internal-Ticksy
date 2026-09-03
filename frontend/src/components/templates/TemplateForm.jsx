import React, { useEffect, useState } from 'react';
import { userService } from '../../services/user';
import { getBatches } from '../../services/batch';

const TemplateForm = ({ template, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    department_ids: template?.departments?.map(d => d.id) || [],
    category_ids: template?.categories?.map(c => c.id) || [],
    batch_ids: template?.batches?.map(b => b.id) || []
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      const [departmentsData, categoriesData, batchesData] = await Promise.all([
        userService.getDepartments(),
        userService.getCategories(),
        getBatches()
      ]);
      setDepartments(departmentsData);
      setCategories(categoriesData);
      setBatches(batchesData);
    };

    fetchOptions().catch((e) => console.error('Error loading template options:', e));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSelection = (field, id) => {
    setFormData((prev) => {
      const selected = prev[field] || [];
      return {
        ...prev,
        [field]: selected.includes(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id]
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      return;
    }
    onSubmit({
      name: formData.name.trim(),
      department_ids: formData.department_ids,
      category_ids: formData.category_ids,
      batch_ids: formData.batch_ids
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Template Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
        <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
          {departments.map((department) => (
            <div key={department.id} className="flex items-center py-2">
              <input
                type="checkbox"
                checked={formData.department_ids.includes(department.id)}
                onChange={() => toggleSelection('department_ids', department.id)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{department.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
        <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center py-2">
              <input
                type="checkbox"
                checked={formData.category_ids.includes(category.id)}
                onChange={() => toggleSelection('category_ids', category.id)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{category.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Batches</label>
        <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
          {batches.map((batch) => (
            <div key={batch.id} className="flex items-center py-2">
              <input
                type="checkbox"
                checked={formData.batch_ids.includes(batch.id)}
                onChange={() => toggleSelection('batch_ids', batch.id)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{batch.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Save Template</button>
      </div>
    </form>
  );
};

export default TemplateForm;