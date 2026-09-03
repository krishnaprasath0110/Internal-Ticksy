import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ticketService } from '../../services/ticket';
import { createThread, getThreadsByTicket } from '../../services/thread';
import { MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { getStatus } from '../../services/status';
import { toast } from 'react-toastify';
import { getCategories } from '../../services/category';
import { getDepartments } from '../../services/department';
import { getDispositions, getIssueTypes } from '../../services/issueType';
import { ROLES } from '../../utils/roles';

const AttachmentList = ({ attachments, isDark }) => {
  // Handle both string and array inputs, ensure we have a clean array of URLs
  const normalizeAttachments = (attachs) => {
    if (!attachs) return [];
    
    // If it's already an array, filter out any non-string values
    if (Array.isArray(attachs)) {
      return attachs.filter(url => typeof url === 'string' && url.trim());
    }
    
    // If it's a string, try to parse it as JSON
    if (typeof attachs === 'string') {
      try {
        const parsed = JSON.parse(attachs);
        return Array.isArray(parsed) ? parsed.filter(url => typeof url === 'string' && url.trim()) : [];
      } catch {
        // If parsing fails, check if it's a single URL
        return attachs.trim() ? [attachs] : [];
      }
    }
    
    return [];
  };

  const urls = normalizeAttachments(attachments);
  if (!urls.length) return null;
  
  return (
    <div className="mt-2">
      <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Attachments:</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
              isDark 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {url.split('/').pop()}
          </a>
        ))}
      </div>
    </div>
  );
};


const ThreadItem = ({ thread, isDark }) => (
  <div className={`bg-gray-50 ${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg mb-4`}>
    <div className="flex justify-between items-start mb-2">
      <div>
        <span className={`font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {thread.is_system ? 'System' : (thread.user?.name || 'Unknown')}
        </span>
        <span className={`text-gray-500 ${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm ml-2`}>
          {thread.created_at ? new Date(thread.created_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }) : 'N/A'}
        </span>
      </div>
    </div>
    <p className={`text-gray-700 ${isDark ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap`}>{thread.message}</p>
    <AttachmentList attachments={thread.attachments} isDark={isDark} />
  </div>
);

const TicketView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [ticket, setTicket] = useState(null);
  const [threads, setThreads] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [threadAttachments, setThreadAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reassigning, setReassigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [closingReason, setClosingReason] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentAssignConfirm, setShowAgentAssignConfirm] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);

  // New state for the combined reassignment flow
  const [reassignState, setReassignState] = useState({
    departmentId: '',
    categoryId: '',
    agentId: '',
  });
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [reassignmentComment, setReassignmentComment] = useState('');
  
  // Priority state
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [issueTypes, setIssueTypes] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState('');
  const [selectedDispositionId, setSelectedDispositionId] = useState('');
  const [updatingIssueClassification, setUpdatingIssueClassification] = useState(false);

  // Check if user is authorized to reassign tickets
  const canReassignTickets = user && (
    user.role.name === ROLES.AGENT ||
    user.role.name === ROLES.ADMIN ||
    user.role.name === ROLES.DEPARTMENT_MANAGER ||
    user.role.name === ROLES.DEPARTMENT_SUPERVISOR
  );
  const canClassifyTicket = user?.role?.name !== ROLES.CANDIDATE;

  // Constants for file limits
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  const MAX_FILES = 3;

  const statusColors = {
    'Open': 'bg-green-100 text-green-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    'Closed': 'bg-gray-100 text-gray-800',
    'Delayed': 'bg-red-100 text-red-800'
  };
  const allowedStatusNames = ['open', 'in-progress', 'closed'];
  const visibleStatuses = statuses.filter(status => allowedStatusNames.includes(status.name?.toLowerCase()));
  const requiresClassificationBeforeClose = canClassifyTicket;

  const fetchThreads = async () => {
    try {
      const data = await getThreadsByTicket(id);
      setThreads(data);
    } catch (error) {
      console.error('Error fetching threads:', error);
      setError('Failed to load thread history');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ticketData, threadsData] = await Promise.all([
          ticketService.getTicketById(id),
          getThreadsByTicket(id)
        ]);
        setTicket(ticketData);
        setThreads(threadsData);
      } catch (err) {
        setError('Failed to load ticket data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Failed to load departments');
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchStatuses = async () => {
    try {
      const data = await getStatus();
      setStatuses(data);
    } catch (error) {
      console.error('Error fetching statuses:', error);
      setError('Failed to load statuses');
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (!canClassifyTicket) return;

    const fetchIssueTypeData = async () => {
      try {
        const data = await getIssueTypes();
        setIssueTypes(data || []);
      } catch (error) {
        console.error('Error fetching issue types:', error);
        toast.error('Failed to load issue types');
      }
    };

    fetchIssueTypeData();
  }, [canClassifyTicket]);

  useEffect(() => {
    if (!ticket) return;
    setSelectedIssueTypeId(ticket.issue_type?.id || '');
    setSelectedDispositionId(ticket.disposition?.id || '');
  }, [ticket]);

  useEffect(() => {
    if (!selectedIssueTypeId || !canClassifyTicket) {
      setDispositions([]);
      return;
    }

    const fetchDispositionData = async () => {
      try {
        const data = await getDispositions(selectedIssueTypeId);
        setDispositions(data || []);
      } catch (error) {
        console.error('Error fetching dispositions:', error);
        toast.error('Failed to load dispositions');
      }
    };

    fetchDispositionData();
  }, [selectedIssueTypeId, canClassifyTicket]);

  useEffect(() => {
    if (ticket?.category?.department_id && departments.length > 0 && categories.length > 0) {
      setSelectedDepartment(ticket.category.department_id);
      // Only set the category if it exists in the filtered categories
      const departmentCategories = categories.filter(
        cat => cat.department_id === ticket.category.department_id
      );
      const currentCategory = departmentCategories.find(cat => cat.id === ticket.category.id);
      if (currentCategory) {
        setSelectedCategory(ticket.category.id);
        // Also update filtered categories for the current department
        setFilteredCategories(departmentCategories);
      }
      
      // Initialize reassignState with current ticket's department and category
      setReassignState({
        departmentId: ticket.category.department_id,
        categoryId: ticket.category.id,
        agentId: '', // Keep agent empty for selection
      });
      
      // Fetch agents for the current category
      if (canReassignTickets && ticket.category.id) {
        fetchAvailableAgents(ticket.category.id);
      }
    }
  }, [ticket, departments, categories]);

  useEffect(() => {
    if (selectedDepartment && categories.length > 0) {
      const departmentCategories = categories.filter(
        category => category.department_id === parseInt(selectedDepartment, 10)
      );
      setFilteredCategories(departmentCategories);
      // Don't reset selected category if it's still valid for the new department
      if (selectedCategory) {
        const categoryStillValid = departmentCategories.some(cat => cat.id === selectedCategory);
        if (!categoryStillValid) {
          setSelectedCategory(null);
        }
      }
    } else {
      setFilteredCategories([]);
      if (selectedCategory) setSelectedCategory(null);
    }
  }, [selectedDepartment, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setReplyLoading(true);
    try {
      const formData = new FormData();
      formData.append('message', newMessage.trim());
      
      // Check total file size and count
      if (threadAttachments.length > MAX_FILES) {
        toast.error(`You can only upload up to ${MAX_FILES} files at a time`);
        return;
      }

      let totalSize = 0;
      for (const file of threadAttachments) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File ${file.name} is too large. Maximum size is 5MB`);
          return;
        }
        totalSize += file.size;
        formData.append('attachments', file);
      }

      await createThread(ticket.id, formData);
      setNewMessage('');
      setThreadAttachments([]);
      await fetchThreads();
    } catch (error) {
      console.error('Error creating thread:', error);
      setError('Failed to create thread');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
  
    // Check if adding these files would exceed the maximum number
    if (files.length + threadAttachments.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed. You can upload ${MAX_FILES - threadAttachments.length} more files.`);
      return;
    }
  
    const validFiles = [];
    let hasError = false;
  
    files.forEach((file) => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large. Maximum file size is 5MB.`);
        hasError = true;
      } else {
        validFiles.push(file);
      }
    });
  
    if (validFiles.length === 0 && hasError) {
      return;
    }
  
    // Update the attachments with valid files only
    setThreadAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index) => {
    const updatedAttachments = [...threadAttachments];
    updatedAttachments.splice(index, 1);
    setThreadAttachments(updatedAttachments);
  };

  const handleDepartmentSelect = (departmentId) => {
    setSelectedDepartment(departmentId);
    handleReassignmentChange('departmentId', departmentId);
  };

  const handleCategorySelect = async (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    setSelectedCategory(categoryId);
    handleReassignmentChange('categoryId', categoryId);
  };

  const handleAgentSelect = (agentId) => {
    const agent = availableAgents.find(a => a.id === agentId);
    setSelectedAgent(agent);
    handleReassignmentChange('agentId', agentId);
  };

  const handleReassignmentChange = (field, value) => {
    const newState = { ...reassignState, [field]: value };

    // Reset dependent fields if a parent changes
    if (field === 'departmentId') {
      newState.categoryId = '';
      newState.agentId = '';
      setSelectedCategory(null);
      setSelectedAgent(null);
      // Update filtered categories when department changes
      if (value && categories.length > 0) {
        const departmentCategories = categories.filter(
          category => category.department_id === parseInt(value, 10)
        );
        setFilteredCategories(departmentCategories);
      } else {
        setFilteredCategories([]);
      }
      setAvailableAgents([]);
    }
    if (field === 'categoryId') {
      newState.agentId = '';
      setSelectedAgent(null);
      setAvailableAgents([]);
      if (value) {
        fetchAvailableAgents(value); // Fetch agents for the new category
      }
    }

    setReassignState(newState);
  };

  // Check if all fields are selected to enable the button
  const isReassignButtonEnabled = reassignState.departmentId && reassignState.categoryId && reassignState.agentId;

  // Unified confirmation for the entire reassignment
  const handleReassignConfirm = async () => {
    if (!isReassignButtonEnabled) return;
    
    // Check if reassignment comment is provided
    if (!reassignmentComment.trim()) {
      toast.error('Please provide a reason for reassigning the ticket');
      return;
    }

    try {
      setReassigning(true);
      // 1. Reassign category
      await ticketService.reassignTicket(id, reassignState.categoryId);
      // 2. Assign agent
      await ticketService.assignTicketToAgent(id, reassignState.agentId);
      
      // 3. Post reassignment comment as a thread
      const formData = new FormData();
      formData.append('message', `Ticket reassigned: ${reassignmentComment}`);
      await createThread(id, formData);

      toast.success('Ticket successfully reassigned!');
      setReassignmentComment(''); // Clear the comment
      window.location.reload(); // Refresh to see all changes
    } catch (error) {
      console.error('Error during full reassignment:', error);
      toast.error('Failed to reassign ticket.');
    } finally {
      setReassigning(false);
      setShowReassignConfirm(false);
    }
  };

  const handleStatusChange = (statusId) => {
    const status = statuses.find(s => s.id === statusId);
    if (!status) return;

    if (requiresClassificationBeforeClose && status.name.toLowerCase() === 'closed' && (!ticket?.issue_type || !ticket?.disposition)) {
      const message = 'Please select issue type and disposition before closing ticket';
      setStatusError(message);
      toast.error(message);
      return;
    }

    setStatusError(null);
    
    setPendingStatusChange(status);
    setShowStatusConfirm(true);
    
    // Reset closing reason when opening the dialog
    if (status.name.toLowerCase() === 'closed') {
      setClosingReason('');
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    
    // Check if closing reason is required for closed status
    if (requiresClassificationBeforeClose && pendingStatusChange.name.toLowerCase() === 'closed' && (!ticket?.issue_type || !ticket?.disposition)) {
      const message = 'Please select issue type and disposition before closing ticket';
      setStatusError(message);
      toast.error(message);
      return;
    }

    if (pendingStatusChange.name.toLowerCase() === 'closed' && !closingReason.trim()) {
      toast.error('Please provide a reason for closing the ticket');
      return;
    }
    
    try {
      setUpdatingStatus(true);
      setStatusError(null);
      
      // Call the API to update the ticket status with closing reason if applicable
      await ticketService.updateTicketStatus(
        id, 
        pendingStatusChange.id, 
        pendingStatusChange.name.toLowerCase() === 'closed' ? closingReason : null
      );
      
      // If we're closing the ticket, fetch the updated threads to show the closing reason
      if (pendingStatusChange.name.toLowerCase() === 'closed') {
        await fetchThreads();
      }
      
      // Show success message
      toast.success(`Status changed to ${pendingStatusChange.description}`);
      
      // Update the ticket data without refreshing the page
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
    } catch (error) {
      console.error('Error updating status:', error);
      setStatusError('Failed to update ticket status');
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
      setShowStatusConfirm(false);
      setPendingStatusChange(null);
      setClosingReason('');
    }
  };

  const handleCloseTicket = async () => {
    if (requiresClassificationBeforeClose && (!ticket?.issue_type || !ticket?.disposition)) {
      const message = 'Please select issue type and disposition before closing ticket';
      setStatusError(message);
      toast.error(message);
      return;
    }

    // Check if closing reason is provided
    if (!closingReason.trim()) {
      toast.error('Please provide a reason for closing the ticket');
      return;
    }
    
    try {
      const closedStatus = statuses.find(s => s.name.toLowerCase() === 'closed');
      if (!closedStatus) {
        throw new Error('Closed status not found');
      }
      await ticketService.updateTicketStatus(id, closedStatus.id, closingReason);
      
      // Fetch the updated threads to show the closing reason
      await fetchThreads();
      
      toast.success('Ticket has been closed');
      setShowCloseConfirmation(false);
      setClosingReason('');
      
      // Refresh the ticket data
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error('Failed to close ticket');
    }
  };

  const handlePriorityUpdate = async (priority) => {
    if (updatingPriority) return;
    
    try {
      setUpdatingPriority(true);
      await ticketService.updateTicketPriority(id, priority);
      
      // Refresh the ticket data
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
      
      toast.success(`Priority updated to ${priority}`);
    } catch (error) {
      console.error('Error updating priority:', error);
      toast.error('Failed to update priority');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleIssueTypeChange = (issueTypeId) => {
    setSelectedIssueTypeId(issueTypeId);
    setSelectedDispositionId('');
  };

  const handleIssueClassificationUpdate = async (issueTypeId = selectedIssueTypeId, dispositionId = selectedDispositionId) => {
    if (!issueTypeId) {
      toast.error('Please select an issue type');
      return;
    }
    if (!dispositionId) {
      toast.error('Please select a disposition');
      return;
    }

    try {
      setUpdatingIssueClassification(true);
      const updatedTicket = await ticketService.updateTicketIssueClassification(
        id,
        issueTypeId,
        dispositionId
      );
      setTicket(updatedTicket);
      toast.success('Issue type and disposition updated');
    } catch (error) {
      console.error('Error updating issue classification:', error);
      toast.error(error?.detail || 'Failed to update issue type/disposition');
    } finally {
      setUpdatingIssueClassification(false);
    }
  };

  const handleDispositionChange = (dispositionId) => {
    setSelectedDispositionId(dispositionId);
    if (selectedIssueTypeId && dispositionId) {
      handleIssueClassificationUpdate(selectedIssueTypeId, dispositionId);
    }
  };

  // Fetch available agents for the current ticket category
  const fetchAvailableAgents = async (categoryId) => {
    if (!categoryId) return;
    
    try {
      const agents = await ticketService.getAgentsByCategory(categoryId);
      setAvailableAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load available agents');
    }
  };

  // Load agents when ticket is loaded
  useEffect(() => {
    if (ticket?.category?.id && canReassignTickets) {
      fetchAvailableAgents(ticket.category.id);
    }
  }, [ticket?.category?.id, canReassignTickets]);

  const confirmAgentAssignment = async () => {
    if (!selectedAgent) return;

    try {
      setAssigningAgent(true);
      await ticketService.assignTicketToAgent(id, selectedAgent.id);
      toast.success(`Ticket assigned to ${selectedAgent.name}`);
      
      // Reload ticket data
      const updatedTicket = await ticketService.getTicketById(id);
      setTicket(updatedTicket);
      
      setShowAgentAssignConfirm(false);
      setSelectedAgent(null);
    } catch (error) {
      console.error('Error assigning ticket to agent:', error);
      toast.error('Failed to assign ticket to agent');
    } finally {
      setAssigningAgent(false);
    }
  };

  const isTicketClosed = ticket?.status?.description === 'Closed';

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} py-6`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className={`h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
              <div className="space-y-2">
                <div className={`h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded`}></div>
                <div className={`h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded w-5/6`}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} py-6`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`bg-red-50 ${isDark ? 'border-gray-700' : 'border-red-400'} p-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className={`h-5 w-5 ${isDark ? 'text-red-500' : 'text-red-400'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
              <div className="ml-3">
                <p className={`text-sm ${isDark ? 'text-red-500' : 'text-red-700'}`}>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderFileUpload = () => (
    <div className="mt-4">
      <div className="flex items-center space-x-2">
        <label className={`flex items-center px-4 py-2 rounded-md cursor-pointer ${
          isDark 
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Files</span>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        </label>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Up to {MAX_FILES} files, max 5MB each
        </span>
      </div>

      {threadAttachments.length > 0 && (
        <div className="mt-2">
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Selected files:
          </div>
          <div className="mt-1 space-y-2">
            {threadAttachments.map((file, index) => (
              <div key={index} className={`flex items-center justify-between p-2 rounded ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(index)}
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
        </div>
      )}
    </div>
  );

  const renderReplyForm = () => {
    // Check if ticket is closed and user is a candidate
    const isTicketClosedForCandidate = isTicketClosed && user?.role?.name === ROLES.CANDIDATE;
    
    if (isTicketClosedForCandidate) {
      return (
        <div className={`mt-6 p-4 rounded-lg border-2 border-dashed ${
          isDark 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center justify-center space-x-2">
            <svg className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              This ticket is closed. You cannot add replies to a closed ticket.
            </p>
          </div>
          <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            An agent can reopen this ticket if needed.
          </p>
        </div>
      );
    }
    
    return (
      <form onSubmit={handleSubmit} className="mt-6">
        <div className="space-y-4">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write your reply..."
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500' 
                : 'border-gray-300 focus:border-indigo-500'
            } focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 transition-colors duration-200`}
            rows={4}
            required
          />
          {renderFileUpload()}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={replyLoading}
              className={`inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium text-white ${
                isDark 
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {replyLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Posting...</span>
                </>
              ) : (
                'Post Reply'
              )}
            </button>
          </div>
        </div>
      </form>
    );
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} py-6`}>
      <div className="max-w-9xl mx-auto sm:px-6">
        {/* Header */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow sm:rounded-lg`}>
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg leading-6 font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  Ticket #{ticket?.id} - {ticket?.title}
                </h3>
                <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Created by {ticket?.created_by?.name} on {new Date(ticket?.created_at).toLocaleDateString()}
                </p>
                {ticket?.created_by?.batch_info && (
                  <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2"
                          title={ticket?.created_by?.email}
                        >
                          Email - {ticket?.created_by?.email}
                        </span>
                    <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-1"
                          title={ticket?.created_by?.batch_info?.university_name}
                        >
                          University - {ticket?.created_by?.batch_info?.university_name}
                        </span>
                    <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-1 my-1"
                          title={ticket?.created_by?.batch_info?.program_name}
                        >
                          Program - {ticket?.created_by?.batch_info?.program_name}
                        </span>
                    <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          title={ticket?.created_by?.batch_info?.batch_name}
                        >
                          Batch - {ticket?.created_by?.batch_info?.batch_name}
                        </span>
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => navigate(`/tickets${location.search}`)}
                  className={`inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`
                }
                >
                  Back to Tickets
                </button>
              </div>
            </div>
          </div>
          <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              <div className="lg:col-span-2 space-y-6">
                <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
                  <h4 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-4`}>Description</h4>
                  <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap`}>{ticket?.description}</p>
                  <AttachmentList attachments={ticket?.attachments} isDark={isDark} />
                </div>

                {/* Comments Section */}
                <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
                  <h4 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-6`}>Posts</h4>
                  <div className="space-y-6">
                    {threads.map(thread => (
                      <ThreadItem key={thread.id} thread={thread} isDark={isDark} />
                    ))}
                    {renderReplyForm()}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 space-y-6`}>
                  <div>
                    {/* <label className="text-sm font-medium text-gray-500">Status</label> */}
                    {/* Conditionally render Select or Text based on the user role */}
                    {user?.role?.name === ROLES.CANDIDATE ? (
                      <div className="flex items-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isTicketClosed 
                            ? 'bg-gray-100 text-gray-800' 
                            : statusColors[ticket?.status?.description]
                        }`}>
                          {/* {isTicketClosed ? 'Closed' : 'Open'} */}
                          {ticket?.status?.description}
                        </span>
                        {!isTicketClosed && (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowCloseConfirmation(true)}
                              className="ml-3 inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Close Ticket
                            </button>
                            {/* Confirmation Dialog */}
                            {showCloseConfirmation && (
                              <div className="fixed z-10 inset-0 overflow-y-auto">
                                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                                  </div>
                                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                                    <div>
                                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                      </div>
                                      <div className="mt-3 text-center sm:mt-5">
                                        <h3 className="text-lg font-medium text-gray-900">
                                          Close Ticket
                                        </h3>
                                        <div className="mt-2">
                                          <p className="text-sm text-gray-500 mb-4">
                                            Are you sure you want to close this ticket? This action cannot be undone.
                                          </p>
                                          <div className="mb-4">
                                            <label htmlFor="closeTicketReason" className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                              Reason for closing ticket <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                              id="closeTicketReason"
                                              value={closingReason}
                                              onChange={(e) => setClosingReason(e.target.value)}
                                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                              rows="3"
                                              placeholder="Please provide a reason for closing this ticket"
                                              required
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                      <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        onClick={() => {
                                          setShowCloseConfirmation(false);
                                          setClosingReason('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-500 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        onClick={handleCloseTicket}
                                      >
                                        Close Ticket
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <FormControl fullWidth size="small" className="mt-1">
                        <label className="text-sm font-medium text-gray-500">Status</label>
                          <Select
                            labelId="status-label"
                            value={ticket?.status?.id || ''}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            disabled={updatingStatus}
                            displayEmpty
                            className="mt-1"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            
                            {visibleStatuses.map((status) => (
                              <MenuItem
                                key={status.id}
                                value={status.id}
                                disabled={status.id === ticket?.status?.id}
                                className="flex items-center gap-2"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${statusColors[status.description] || 'bg-gray-200'}`}></span>
                                {status.description}
                              </MenuItem>
                            ))}
                          </Select>
                      </FormControl>
                    )}
                    {statusError && <p className="mt-1 text-sm text-red-600">{statusError}</p>}
                    {showStatusConfirm && pendingStatusChange && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Confirm Status Change
                          </h3>
                          <p className="text-gray-600 mb-6">
                            Are you sure you want to change the status to "{pendingStatusChange.description}"?
                          </p>
                          
                          {/* Add closing reason input field when status is "closed" */}
                          {pendingStatusChange.name.toLowerCase() === 'closed' && (
                            <div className="mb-4">
                              <label htmlFor="closingReason" className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for closing ticket <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                id="closingReason"
                                value={closingReason}
                                onChange={(e) => setClosingReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                rows="3"
                                placeholder="Please provide a reason for closing this ticket"
                                required
                              />
                            </div>
                          )}
                          
                          <div className="flex justify-end space-x-3">
                            <button
                              type="button"
                              onClick={() => {
                                setShowStatusConfirm(false);
                                setPendingStatusChange(null);
                                setClosingReason('');
                              }}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              disabled={updatingStatus}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={confirmStatusChange}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                              disabled={updatingStatus}
                            >
                              {updatingStatus ? 'Updating...' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority Selector - Internal Users Only */}
                  
                  {user?.role?.name !== ROLES.CANDIDATE && (
                    <div>
                      <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2 block uppercase`}>
                        Priority
                      </label>
                      <div className="flex gap-2">
                        {['high', 'medium', 'low'].map((priority) => {
                          const isSelected = ticket?.priority === priority;
                          const colors = {
                            high: { text: '#dc2626', border: '#ef4444' },
                            medium: { text: '#d97706', border: '#f59e0b' },
                            low: { text: '#059669', border: '#10b981' }
                          };
                          const color = colors[priority];
                          
                          return (
                            <button
                              key={priority}
                              type="button"
                              onClick={() => handlePriorityUpdate(priority)}
                              disabled={updatingPriority}
                              className={`flex-1 px-2 py-1 rounded border-2 text-xs font-medium uppercase transition-all duration-200 ${
                                isSelected
                                  ? `${isDark ? 'bg-opacity-10' : 'bg-opacity-5'}`
                                  : ''
                              } disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80`}
                              style={{
                                borderColor: color.border,
                                color: color.text,
                                backgroundColor: isSelected ? color.text : 'transparent',
                                color: isSelected ? 'white' : color.text,
                                opacity: isSelected ? 1 : 0.7
                              }}
                            >
                              {priority}
                            </button>
                          );
                        })}
                      </div>
                      {!ticket?.priority && (
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          No priority set
                        </p>
                      )}
                    </div>
                  )}

                  {canClassifyTicket && (
                    <div className="space-y-3 border-t border-gray-500 pt-3">
                      <label className={`text-xs font-medium text-[#4f46e5] mb-2 block uppercase`}>
                        Issue Type & Disposition
                      </label>
                      <FormControl fullWidth size="small">
                        <label id="issue-type-label" className="text-xs font-medium text-gray-500">Issue Type</label>
                        <Select
                          labelId="issue-type-label"
                          value={selectedIssueTypeId || ''}
                          onChange={(e) => handleIssueTypeChange(e.target.value)}
                          disabled={updatingIssueClassification}
                          className="mt-1"
                          sx={{ fontSize: '0.75rem' }}
                          displayEmpty
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>Select issue type</em>
                          </MenuItem>
                          {issueTypes.map((issueType) => (
                            <MenuItem key={issueType.id} value={issueType.id} sx={{ fontSize: '0.75rem' }}>
                              {issueType.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth size="small">
                        <label id="disposition-label" className="text-xs font-medium text-gray-500">Disposition</label>
                        <Select
                          labelId="disposition-label"
                          value={selectedDispositionId || ''}
                          onChange={(e) => handleDispositionChange(e.target.value)}
                          disabled={updatingIssueClassification || !selectedIssueTypeId}
                          className="mt-1"
                          sx={{ fontSize: '0.75rem' }}
                          displayEmpty
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>{selectedIssueTypeId ? 'Select disposition' : 'Select issue type first'}</em>
                          </MenuItem>
                          {dispositions.map((disposition) => (
                            <MenuItem key={disposition.id} value={disposition.id} sx={{ fontSize: '0.75rem' }}>
                              {disposition.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {updatingIssueClassification && (
                        <p className="text-xs text-gray-500">Saving classification...</p>
                      )}
                    </div>
                  )}

                  { canReassignTickets ? (
                    <div className="flex flex-col gap-3 border-t border-gray-500 pt-3">
                      <label className={`text-xs font-medium text-[#4f46e5] mb-2 block uppercase `}>Reassign Ticket</label>
                      <FormControl fullWidth size="small" className="mt-1">
                        <label id="department-label" className="text-xs font-medium text-gray-500">Department</label>
                        <Select
                          labelId="department-label"
                          value={reassignState.departmentId || ''}
                          onChange={(e) => handleDepartmentSelect(e.target.value)}
                          disabled={reassigning}
                          className="mt-1"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>Select a department</em>
                          </MenuItem>
                          {departments.map((department) => (
                            <MenuItem
                              key={department.id}
                              value={department.id}
                              className="flex items-center gap-2 text-xs"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              <span className="flex-grow">{department.name}</span>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <FormControl fullWidth size="small" className="mt-1">
                        <label id="category-label" className="text-xs font-medium text-gray-500">Category</label>
                        <Select
                          labelId="category-label"
                          value={reassignState.categoryId || ''}
                          onChange={(e) => handleCategorySelect(e.target.value)}
                          disabled={reassigning || !reassignState.departmentId}
                          className="mt-1"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>{reassignState.departmentId ? 'Select a category' : 'Please select a department first'}</em>
                          </MenuItem>
                          {filteredCategories.map((category) => (
                            <MenuItem
                              key={category.id}
                              value={category.id}
                              disabled={category.id === ticket?.category?.id}
                              className="flex items-center gap-2 text-xs"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              <span className="flex-grow">{category.name}</span>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small" className="mt-1">
                        <label id="agent-label" className="text-xs font-medium text-gray-500">Agent</label>
                        <Select
                          labelId="agent-label"
                          value={reassignState.agentId || ''}
                          onChange={(e) => handleAgentSelect(e.target.value)}
                          disabled={reassigning || !reassignState.categoryId}
                          className="mt-1"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>{reassignState.categoryId ? 'Select an agent' : 'Please select a category first'}</em>
                          </MenuItem>
                          {availableAgents.map((agent) => (
                            <MenuItem
                              key={agent.id}
                              value={agent.id}
                              disabled={ticket?.assigned_to?.id === agent.id}
                              className="flex items-center gap-2 text-xs"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              <span className="flex-grow">{agent.name}</span>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowReassignConfirm(true)}
                        disabled={!isReassignButtonEnabled}
                        className={`inline-flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium text-white text-center ${
                          isDark 
                            ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Reassign
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-2 block uppercase">Category</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {ticket?.category?.name || 'Unassigned'}
                      </p>
                    </div>
                  )}

                  {showReassignConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Confirm Reassignment
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Are you sure you want to reassign this ticket to <strong>{selectedAgent?.name}</strong>?
                        </p>
                        <div className="mb-4">
                          <label htmlFor="reassignmentComment" className="block text-sm font-medium text-gray-700 mb-1">
                            Reason for reassignment <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            id="reassignmentComment"
                            value={reassignmentComment}
                            onChange={(e) => setReassignmentComment(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            rows="3"
                            placeholder="Please provide a reason for reassigning this ticket"
                            disabled={reassigning}
                          />
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowReassignConfirm(false);
                              setReassignmentComment('');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={reassigning}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleReassignConfirm}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            disabled={reassigning}
                          >
                            {reassigning ? 'Reassigning...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {user?.role?.name !== ROLES.CANDIDATE && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block uppercase">Assigned Agents</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {/* Show manually assigned agent if assigned_to is set */}
                      {ticket?.assigned_to ? (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          title={ticket.assigned_to.email}
                        >
                          {ticket.assigned_to.name} (Manually Assigned)
                        </span>
                      ) : (
                        /* Otherwise show auto-assigned agents (batch-based) */
                        ticket?.category_agents && ticket.category_agents.length > 0 ? (
                          ticket.category_agents.map((agent) => (
                            <span
                              key={agent.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                              title={agent.email}
                            >
                              {agent.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No agents assigned</span>
                        )
                      )}
                    </div>
                  </div>
                  )}

                  {user?.role?.name !== ROLES.CANDIDATE && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block uppercase">Created By</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {ticket?.created_by?.name} ({ticket?.created_by?.email})
                    </p>
                  </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Created At</label>
                    <p className="mt-1 text-sm text-gray-900">
                    {ticket?.created_at && new Date(ticket.created_at + 'Z').toLocaleString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketView;