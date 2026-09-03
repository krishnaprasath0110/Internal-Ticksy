import React, { useState, useEffect } from 'react';
import { getUniversities, createUniversity, updateUniversity, deleteUniversity } from '../../services/university';
import UniversityForm from '../../components/universities/UniversityForm';
import Modal from '../../components/common/Modal';
import { toast } from 'react-toastify';

const UniversitiesPage = () => {
  const [universities, setUniversities] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUniversities();
  }, []);

  const fetchUniversities = async () => {
    try {
      const data = await getUniversities();
      setUniversities(data);
    } catch (error) {
      console.error('Error fetching universities:', error);
      toast.error('Failed to fetch universities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedUniversity(null);
    setIsModalOpen(true);
  };

  const handleEdit = (university) => {
    setSelectedUniversity(university);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this university?')) {
      try {
        await deleteUniversity(id);
        toast.success('University deleted successfully');
        fetchUniversities();
      } catch (error) {
        console.error('Error deleting university:', error);
        toast.error('Failed to delete university');
      }
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedUniversity) {
        await updateUniversity(selectedUniversity.id, formData);
        toast.success('University updated successfully');
      } else {
        await createUniversity(formData);
        toast.success('University created successfully');
      }
      setIsModalOpen(false);
      fetchUniversities();
    } catch (error) {
      console.error('Error saving university:', error);
      toast.error('Failed to save university');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Universities</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Add University
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {universities.map((university) => (
            <li key={university.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{university.name}</h2>
                  <p className="text-sm text-gray-500">{university.description}</p>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleEdit(university)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(university.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUniversity ? 'Edit University' : 'Add University'}
      >
        <UniversityForm
          university={selectedUniversity}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default UniversitiesPage;
