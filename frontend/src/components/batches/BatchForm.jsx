import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { getUniversities } from '../../services/university';
import { getPrograms } from '../../services/program';

const BatchForm = ({ onSubmit, initialData = null }) => {
  const [universities, setUniversities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm({
    defaultValues: {
      name: '',
      description: '',
      university_id: '',
      program_id: ''
    }
  });

  // Watch university selection to trigger program fetch
  const selectedUniversityId = watch('university_id');

  // Fetch universities on component mount
  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        setLoading(true);
        const response = await getUniversities();
        setUniversities(response);
      } catch (error) {
        console.error('Error fetching universities:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUniversities();
  }, []);

  // Reset form when initialData changes (edit mode)
  useEffect(() => {
    if (initialData) {
      // Set form values with initialData
      reset({
        name: initialData.name || '',
        description: initialData.description || '',
        university_id: initialData.program?.university_id?.toString() || '',
        program_id: initialData.program_id?.toString() || ''
      });
    } else {
      // Reset to empty form for create mode
      reset({
        name: '',
        description: '',
        university_id: '',
        program_id: ''
      });
    }
  }, [initialData, reset]);

  // Fetch programs when university is selected
  useEffect(() => {
    const fetchPrograms = async () => {
      if (selectedUniversityId) {
        try {
          setLoading(true);
          const response = await getPrograms();
          // Filter programs by selected university
          const filteredPrograms = response.filter(
            program => program.university_id === parseInt(selectedUniversityId)
          );
          setPrograms(filteredPrograms);
          // Don't clear program selection when initialData is being loaded
          if (!initialData) {
            setValue('program_id', '');
          }
        } catch (error) {
          console.error('Error fetching programs:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setPrograms([]);
        if (!initialData) {
          setValue('program_id', '');
        }
      }
    };
    fetchPrograms();
  }, [selectedUniversityId, setValue, initialData]);

  const handleFormSubmit = (data) => {
    // Remove university_id as it's not needed in the backend
    const { university_id, ...submitData } = data;
    onSubmit(submitData);
  };

  if (loading) {
    return <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* University Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          University
        </label>
        <select
          {...register('university_id', { required: 'University is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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

      {/* Program Selection - Only shown when university is selected */}
      
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Program
          </label>
          <select
            {...register('program_id', { required: 'Program is required' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
      

      {/* Batch Details - Only shown when program is selected */}
    
        <>
          {/* Batch Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Batch Name
            </label>
            <input
              type="text"
              {...register('name', { required: 'Batch name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </>
      

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={!watch('program_id')}
          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
            ${watch('program_id') 
              ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              : 'bg-gray-400 cursor-not-allowed'}`}
        >
          {initialData ? 'Update Batch' : 'Create Batch'}
        </button>
      </div>
    </form>
  );
};

export default BatchForm;
