import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { getUniversities } from '../../services/university';
import { getPrograms } from '../../services/program';
import { getBatches } from '../../services/batch';
import { userService } from '../../services/user';
import { toast } from 'react-toastify';

const CandidateForm = ({ candidate, onClose, onSubmit, isSubmitting }) => {
  const [universities, setUniversities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: candidate?.name || '',
      email: candidate?.email || '',
      university_id: candidate?.user_batches?.[0]?.batch?.program?.university?.id || '',
      program_id: candidate?.user_batches?.[0]?.batch?.program?.id || '',
      batch_id: candidate?.user_batches?.[0]?.batch?.id || '',
      role_id: candidate?.role_id || '',
    }
  });

  const selectedUniversityId = watch('university_id');
  const selectedProgramId = watch('program_id');

  // Fetch universities on mount
  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        setLoading(true);
        const data = await getUniversities();
        setUniversities(data);
      } catch (error) {
        toast.error('Failed to fetch universities');
      } finally {
        setLoading(false);
      }
    };
    fetchUniversities();
  }, []);

  // Fetch programs when university is selected
  useEffect(() => {
    const fetchPrograms = async () => {
      if (selectedUniversityId) {
        try {
          setLoading(true);
          const data = await getPrograms({ university_id: selectedUniversityId });
          setPrograms(data);
          if (!candidate) {
            setValue('program_id', '');
            setValue('batch_id', '');
          }
        } catch (error) {
          toast.error('Failed to fetch programs');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchPrograms();
  }, [selectedUniversityId, setValue]);

  // Fetch batches when program is selected
  useEffect(() => {
    const fetchBatches = async () => {
      if (selectedProgramId) {
        try {
          setLoading(true);
          const data = await getBatches({ program_id: selectedProgramId });
          setBatches(data);
          if (!candidate) {
            setValue('batch_id', '');
          }
        } catch (error) {
          toast.error('Failed to fetch batches');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchBatches();
  }, [selectedProgramId, setValue]);

  // Load initial data for edit mode
  useEffect(() => {
    const loadInitialData = async () => {
      if (candidate) {
        try {
          setLoading(true);
          // Load programs for the selected university
          if (candidate.user_batches?.[0]?.batch?.program?.university?.id) {
            const programsData = await getPrograms({ 
              university_id: candidate.user_batches[0].batch.program.university.id 
            });
            setPrograms(programsData);
          }
          
          // Load batches for the selected program
          if (candidate.user_batches?.[0]?.batch?.program?.id) {
            const batchesData = await getBatches({ 
              program_id: candidate.user_batches[0].batch.program.id 
            });
            setBatches(batchesData);
          }
        } catch (error) {
          toast.error('Failed to load candidate data');
        } finally {
          setLoading(false);
        }
      }
    };
    loadInitialData();
  }, [candidate]);

  const onFormSubmit = async (data) => {
    try {
      setLoading(true);
      const formData = {
        ...data,
        role_id: 5, // Always set role_id to 5 for candidates
      };

      if (candidate) {
        const updatedCandidate = await userService.updateCandidate(candidate.id, formData);
        console.log(updatedCandidate);
        // toast.success('Candidate updated successfully');
      } else {
        const createdCandidate = await userService.createCandidate(formData);
        console.log(createdCandidate);
        // toast.success('Candidate created successfully');
      }
      onClose();
      onSubmit?.();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save candidate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative mx-auto p-6 border w-[32rem] shadow-lg rounded-lg bg-white mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 text-xl font-semibold"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                {...register('name', { required: 'Name is required' })}
                className="mt-1 block w-full px-4 py-3 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter candidate's name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                className="mt-1 block w-full px-4 py-3 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                University
              </label>
              <select
                {...register('university_id', { required: 'University is required' })}
                className="mt-1 block w-full px-4 py-3 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select University</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </select>
              {errors.university_id && (
                <p className="mt-1 text-sm text-red-600">{errors.university_id.message}</p>
              )}
            </div>

            {selectedUniversityId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program
                </label>
                <select
                  {...register('program_id', { required: 'Program is required' })}
                  className="mt-1 block w-full px-4 py-3 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Program</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
                {errors.program_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.program_id.message}</p>
                )}
              </div>
            )}

            {selectedProgramId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch
                </label>
                <select
                  {...register('batch_id', { required: 'Batch is required' })}
                  className="mt-1 block w-full px-4 py-3 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
                {errors.batch_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.batch_id.message}</p>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  loading 
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (candidate ? 'Updating...' : 'Creating...') : (candidate ? 'Update Candidate' : 'Create Candidate')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CandidateForm;
