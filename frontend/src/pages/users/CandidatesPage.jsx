import React, { useState, useEffect } from 'react';
import { userService } from '../../services/user';
import { toast } from 'react-toastify';
import CandidateForm from '../../components/users/CandidateForm';
import { PencilIcon, TrashIcon, SearchIcon } from '@heroicons/react/outline';
import DeleteConfirmationModal from '../../components/common/DeleteConfirmationModal';
import { ROLES } from '../../utils/roles';
import ImportCandidatesDialog from '../../components/users/ImportCandidatesDialog';
import { getUniversities } from '../../services/university';
import { getPrograms } from '../../services/program';
import { getBatches } from '../../services/batch';

const CandidatesPage = () => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  
  // Filter options
  const [universities, setUniversities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    fetchCandidates();
    fetchUniversities();
    fetchPrograms();
    fetchBatches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [candidates, searchTerm, selectedUniversity, selectedProgram, selectedBatch]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers();
      const candidateUsers = response.filter(user => user.role.name === 'candidate');
      setCandidates(candidateUsers);
      setFilteredCandidates(candidateUsers);
    } catch (error) {
      toast.error('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchUniversities = async () => {
    try {
      const data = await getUniversities();
      setUniversities(data);
    } catch (error) {
      console.error('Failed to fetch universities:', error);
    }
  };

  const fetchPrograms = async () => {
    try {
      const data = await getPrograms();
      setPrograms(data);
    } catch (error) {
      console.error('Failed to fetch programs:', error);
    }
  };

  const fetchBatches = async () => {
    try {
      const data = await getBatches();
      setBatches(data);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...candidates];

    // Search filter (name or email)
    if (searchTerm) {
      filtered = filtered.filter(candidate =>
        candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // University filter
    if (selectedUniversity) {
      filtered = filtered.filter(candidate =>
        candidate.user_batches[0]?.batch.program.university.id === parseInt(selectedUniversity)
      );
    }

    // Program filter
    if (selectedProgram) {
      filtered = filtered.filter(candidate =>
        candidate.user_batches[0]?.batch.program.id === parseInt(selectedProgram)
      );
    }

    // Batch filter
    if (selectedBatch) {
      filtered = filtered.filter(candidate =>
        candidate.user_batches[0]?.batch.id === parseInt(selectedBatch)
      );
    }

    setFilteredCandidates(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedUniversity('');
    setSelectedProgram('');
    setSelectedBatch('');
  };

  const handleEdit = (candidate) => {
    setSelectedCandidate(candidate);
    setShowCandidateForm(true);
  };

  const handleDelete = async (candidate) => {
    setCandidateToDelete(candidate);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await userService.deleteUser(candidateToDelete.id);
      toast.success('Candidate deleted successfully');
      await fetchCandidates();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete candidate';
      toast.error(errorMessage);
    } finally {
      setShowDeleteModal(false);
      setCandidateToDelete(null);
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      if (selectedCandidate) {
        await userService.updateUser(selectedCandidate.id, {
          ...formData,
          role_id: ROLES.CANDIDATE
        });
        toast.success('Candidate updated successfully');
      } else {
        await userService.createCandidate({
          ...formData,
          role_id: ROLES.CANDIDATE
        });
        toast.success('Candidate created successfully');
      }
      setShowCandidateForm(false);
      setSelectedCandidate(null);
      await fetchCandidates();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || (selectedCandidate ? 'Failed to update candidate' : 'Failed to create candidate');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {showCandidateForm && (
        <div className="relative z-50">
          <CandidateForm
            candidate={selectedCandidate}
            onClose={() => {
              setShowCandidateForm(false);
              setSelectedCandidate(null);
            }}
            onSubmit={handleFormSubmit}
            isSubmitting={loading}
          />
        </div>
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setCandidateToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Candidate"
          message={`Are you sure you want to delete ${candidateToDelete?.name}? This action cannot be undone.`}
        />
      )}

      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setShowImportDialog(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Import Candidates
            </button>
            <button
              onClick={() => {
                setSelectedCandidate(null);
                setShowCandidateForm(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Add Candidate
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* University Filter */}
            <div>
              <select
                value={selectedUniversity}
                onChange={(e) => setSelectedUniversity(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">All Universities</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Program Filter */}
            <div>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">All Programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Filter */}
            <div>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">All Batches</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || selectedUniversity || selectedProgram || selectedBatch) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Results Count */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredCandidates.length} of {candidates.length} candidates
          </div>
        </div>

        <div className="mt-4 flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        University
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Program
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Active
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                          No candidates found
                        </td>
                      </tr>
                    ) : (
                      filteredCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {candidate.name}
                          <div className="text-xs text-gray-400">{candidate.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.user_batches[0]?.batch.program.university.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.user_batches[0]?.batch.program.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.user_batches[0]?.batch.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${candidate.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {candidate.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => handleEdit(candidate)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(candidate)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCandidateForm && (
        <CandidateForm
          isOpen={showCandidateForm}
          onClose={() => {
            setShowCandidateForm(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            setShowCandidateForm(false);
            setSelectedCandidate(null);
            fetchCandidates();
          }}
          candidate={selectedCandidate}
        />
      )}

      <ImportCandidatesDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={() => {
          setShowImportDialog(false);
          fetchCandidates();
        }}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCandidateToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Candidate"
        message={`Are you sure you want to delete ${candidateToDelete?.name}? This action cannot be undone.`}
      />
    </div>
  );
};

export default CandidatesPage;
