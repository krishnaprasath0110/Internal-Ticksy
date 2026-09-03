import React, { useState, useEffect } from 'react';
import { getPrograms, createProgram, updateProgram, deleteProgram } from '../../services/program';
import ProgramForm from '../../components/programs/ProgramForm';
import Modal from '../../components/common/Modal';
import { toast } from 'react-toastify';

const ProgramsPage = () => {
  const [programs, setPrograms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const data = await getPrograms();
      setPrograms(data);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast.error('Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedProgram(null);
    setIsModalOpen(true);
  };

  const handleEdit = (program) => {
    setSelectedProgram(program);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      try {
        await deleteProgram(id);
        toast.success('Program deleted successfully');
        fetchPrograms();
      } catch (error) {
        console.error('Error deleting program:', error);
        toast.error('Failed to delete program');
      }
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedProgram) {
        await updateProgram(selectedProgram.id, formData);
        toast.success('Program updated successfully');
      } else {
        await createProgram(formData);
        toast.success('Program created successfully');
      }
      setIsModalOpen(false);
      fetchPrograms();
    } catch (error) {
      console.error('Error saving program:', error);
      toast.error('Failed to save program');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Add Program
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {programs.map((program) => (
            <li key={program.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{program.name}</h2>
                  <p className="text-sm text-gray-500">{program.description}</p>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleEdit(program)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(program.id)}
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
        title={selectedProgram ? 'Edit Program' : 'Add Program'}
      >
        <ProgramForm
          program={selectedProgram}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default ProgramsPage;
