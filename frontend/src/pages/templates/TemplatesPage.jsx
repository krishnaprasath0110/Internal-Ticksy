import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../../services/template';
import TemplateForm from '../../components/templates/TemplateForm';
import Modal from '../../components/common/Modal';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(id);
        toast.success('Template deleted successfully');
        await fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete template');
      }
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedTemplate) {
        await updateTemplate(selectedTemplate.id, formData);
        toast.success('Template updated successfully');
      } else {
        await createTemplate(formData);
        toast.success('Template created successfully');
      }
      setIsModalOpen(false);
      await fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Failed to save template');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Add Template
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {templates.map((template) => (
            <li key={template.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{template.name}</h2>
                  <p className="text-sm text-gray-500">
                    Departments: {template.departments?.length || 0} · Categories: {template.categories?.length || 0} · Batches: {template.batches?.length || 0}
                  </p>
                </div>
                <div className="flex space-x-4">
                  <button onClick={() => handleEdit(template)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                  <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedTemplate ? 'Edit Template' : 'Add Template'}
      >
        <TemplateForm
          template={selectedTemplate}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default TemplatesPage;