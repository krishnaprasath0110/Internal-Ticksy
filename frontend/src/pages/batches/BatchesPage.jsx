import React, { useState, useEffect, useRef } from 'react';
import { getBatches, createBatch, updateBatch, deleteBatch, uploadFaqFile, getBatchFaqStatus, deleteBatchFaqs } from '../../services/batch';
import BatchForm from '../../components/batches/BatchForm';
import Modal from '../../components/common/Modal';
import { toast } from 'react-toastify';
import { getUniversities } from '../../services/university';
import { getPrograms } from '../../services/program';
import { SearchIcon } from '@heroicons/react/outline';

const BatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [faqStatuses, setFaqStatuses] = useState({});
  const [uploadingFaq, setUploadingFaq] = useState(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [currentBatchForFaq, setCurrentBatchForFaq] = useState(null);
  const fileInputRef = useRef(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  
  // Filter options
  const [universities, setUniversities] = useState([]);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    fetchBatches();
    fetchUniversities();
    fetchPrograms();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [batches, searchTerm, selectedUniversity, selectedProgram]);

  const fetchBatches = async () => {
    try {
      const data = await getBatches();
      setBatches(data);
      setFilteredBatches(data);
      // Fetch FAQ status for each batch
      fetchAllFaqStatuses(data);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to fetch batches');
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

  const applyFilters = () => {
    let filtered = [...batches];

    // Search filter (batch name or description)
    if (searchTerm) {
      filtered = filtered.filter(batch =>
        batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // University filter
    if (selectedUniversity) {
      filtered = filtered.filter(batch =>
        batch.program.university.id === parseInt(selectedUniversity)
      );
    }

    // Program filter
    if (selectedProgram) {
      filtered = filtered.filter(batch =>
        batch.program.id === parseInt(selectedProgram)
      );
    }

    setFilteredBatches(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedUniversity('');
    setSelectedProgram('');
  };

  const fetchAllFaqStatuses = async (batchesList) => {
    const statuses = {};
    for (const batch of batchesList) {
      try {
        const status = await getBatchFaqStatus(batch.id);
        statuses[batch.id] = status;
      } catch (error) {
        console.error(`Error fetching FAQ status for batch ${batch.id}:`, error);
        statuses[batch.id] = { has_faq_collection: false, faq_count: 0 };
      }
    }
    setFaqStatuses(statuses);
  };

  const openFaqModal = (batch) => {
    setCurrentBatchForFaq(batch);
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsFaqModalOpen(true);
  };

  const closeFaqModal = () => {
    setIsFaqModalOpen(false);
    setCurrentBatchForFaq(null);
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        setUploadError('Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleFaqUpload = async () => {
    if (!selectedFile || !currentBatchForFaq) return;
    
    const batchId = currentBatchForFaq.id;
    setUploadingFaq(batchId);
    setUploadProgress(10);
    setUploadError(null);
    
    try {
      // Start the upload (backend will process in background)
      const result = await uploadFaqFile(batchId, selectedFile);
      
      setUploadProgress(30);
      
      // Poll for completion while showing progress to admin
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds max
      let previousCount = 0;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const status = await getBatchFaqStatus(batchId);
          
          // Update progress based on attempts (simulate progress)
          const progressIncrement = Math.min(30 + (attempts * 2), 90);
          setUploadProgress(progressIncrement);
          
          // Check if FAQ collection exists and has FAQs
          if (status.has_faq_collection && status.faq_count > 0) {
            clearInterval(pollInterval);
            setUploadProgress(100);
            
            // Update FAQ status
            setFaqStatuses(prev => ({ ...prev, [batchId]: status }));
            
            // Show success message
            toast.success(`FAQ upload completed! ${status.faq_count} FAQs loaded.`);
            
            // Close modal after short delay
            setTimeout(() => {
              closeFaqModal();
              setUploadingFaq(null);
            }, 1500);
            
            return;
          }
          
          // If max attempts reached, show timeout
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setUploadError('Upload is taking longer than expected. Please check FAQ status later.');
            setUploadProgress(0);
            setUploadingFaq(null);
          }
          
        } catch (err) {
          console.error('Error polling FAQ status:', err);
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setUploadError('Failed to verify upload completion. Please refresh the page.');
            setUploadProgress(0);
            setUploadingFaq(null);
          }
        }
      }, 2000); // Poll every 2 seconds
      
    } catch (error) {
      console.error('Error uploading FAQ file:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to upload FAQ file. Please check the file format and try again.';
      setUploadError(errorMessage);
      toast.error(errorMessage);
      setUploadProgress(0);
      setUploadingFaq(null);
    }
  };

  const handleDeleteFaqs = async (batchId, batchName) => {
    if (window.confirm(`Are you sure you want to delete all FAQs for ${batchName}?`)) {
      try {
        await deleteBatchFaqs(batchId);
        toast.success(`FAQs deleted for ${batchName}`);
        // Refresh FAQ status
        const status = await getBatchFaqStatus(batchId);
        setFaqStatuses(prev => ({ ...prev, [batchId]: status }));
      } catch (error) {
        console.error('Error deleting FAQs:', error);
        toast.error('Failed to delete FAQs');
      }
    }
  };

  const handleCreateBatch = async (data) => {
    try {
      await createBatch(data);
      toast.success('Batch created successfully');
      setIsModalOpen(false);
      fetchBatches();
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
    }
  };

  const handleUpdateBatch = async (data) => {
    try {
      await updateBatch(selectedBatch.id, data);
      toast.success('Batch updated successfully');
      setIsModalOpen(false);
      setSelectedBatch(null);
      fetchBatches();
    } catch (error) {
      console.error('Error updating batch:', error);
      toast.error('Failed to update batch');
    }
  };

  const handleDeleteBatch = async (id) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      try {
        await deleteBatch(id);
        toast.success('Batch deleted successfully');
        fetchBatches();
      } catch (error) {
        console.error('Error deleting batch:', error);
        toast.error('Failed to delete batch');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Batches</h1>
        <button
          onClick={() => {
            setSelectedBatch(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Create Batch
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by batch name..."
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
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || selectedUniversity || selectedProgram) && (
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
          Showing {filteredBatches.length} of {batches.length} batches
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredBatches.length === 0 ? (
              <li className="px-4 py-8 text-center text-gray-500">
                No batches found
              </li>
            ) : (
              filteredBatches.map((batch) => (
              <li key={batch.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{batch.name}</h3>
                      <p className="mt-1 text-sm text-gray-600">{batch.description}</p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-500">
                          Program: {batch.program.name}
                        </span>
                        <span className="mx-2">•</span>
                        <span className="text-sm text-gray-500">
                          University: {batch.program.university.name}
                        </span>
                      </div>
                      
                      {/* FAQ Status and Upload */}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">FAQs:</span>
                            {faqStatuses[batch.id]?.has_faq_collection ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {faqStatuses[batch.id]?.faq_count || 0} FAQs loaded
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                No FAQs uploaded
                              </span>
                            )}
                          </div>
                          
                          {/* FAQ Upload Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openFaqModal(batch)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Upload FAQs
                            </button>
                            
                            {faqStatuses[batch.id]?.has_faq_collection && (
                              <button
                                onClick={() => handleDeleteFaqs(batch.id, batch.name)}
                                className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                title="Delete FAQs"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-4 ml-4">
                      <button
                        onClick={() => {
                          setSelectedBatch(batch);
                          setIsModalOpen(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))
            )}
          </ul>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBatch(null);
        }}
        title={selectedBatch ? 'Edit Batch' : 'Create Batch'}
      >
        <BatchForm
          onSubmit={selectedBatch ? handleUpdateBatch : handleCreateBatch}
          initialData={selectedBatch}
        />
      </Modal>

      {/* FAQ Upload Modal */}
      <Modal
        isOpen={isFaqModalOpen}
        onClose={closeFaqModal}
        title={`Upload FAQs for ${currentBatchForFaq?.name || 'Batch'}`}
      >
        <div className="space-y-4">
          {/* File Format Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              File Format Requirements
            </h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>Accepted formats:</strong> CSV (.csv) or Excel (.xlsx, .xls)</p>
              <p><strong>Required columns:</strong></p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-900 rounded font-mono text-xs">
                  Sr. No
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-900 rounded font-mono text-xs">
                  Questions
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-900 rounded font-mono text-xs">
                  Answers
                </span>
              </div>
              <p className="text-xs mt-2 text-blue-700">
                Note: Column names are case-insensitive. You can use 'Question'/'Answer' or 'Questions'/'Answers'.
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={uploadingFaq !== null}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: <span className="font-medium">{selectedFile.name}</span>
              </p>
            )}
          </div>

          {/* Upload Progress */}
          {uploadingFaq && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-indigo-900">
                      {uploadProgress < 30 ? 'Uploading file...' : 'Processing FAQs...'}
                    </p>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      Please wait while we process your FAQ file
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium">Progress</span>
                  <span className="text-indigo-600 font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500 flex items-center justify-end"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {uploadProgress > 10 && (
                      <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-red-800">
                  <p className="font-medium">Upload Failed</p>
                  <p className="mt-1">{uploadError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t">
            {uploadingFaq && (
              <p className="text-xs text-gray-500 mb-3 text-center">
                Processing is happening in the background. The modal will close automatically when complete.
              </p>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeFaqModal}
                disabled={uploadingFaq !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFaq ? 'Processing...' : 'Cancel'}
              </button>
              <button
                onClick={handleFaqUpload}
                disabled={!selectedFile || uploadingFaq !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploadingFaq ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BatchesPage;
