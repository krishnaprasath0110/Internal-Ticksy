import React, { useState, useEffect } from 'react';
import { userService } from '../../services/user';
import { toast } from 'react-toastify';
import AgentForm from '../../components/users/AgentForm';
import { PencilIcon, TrashIcon } from '@heroicons/react/outline';
import DeleteConfirmationModal from '../../components/common/DeleteConfirmationModal';
import {ROLES} from '../../utils/roles'

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers();
      // console.log(response);
      const agentUsers = response.filter(user => user.role.name !== ROLES.CANDIDATE);
      setAgents(agentUsers);
    } catch (error) {
      toast.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agent) => {
    setSelectedAgent(agent);
    setShowAgentForm(true);
  };

  const handleDelete = async (agent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await userService.deleteUser(agentToDelete.id);
      toast.success('Agent deleted successfully');
      await fetchAgents();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete agent';
      toast.error(errorMessage);
    } finally {
      setShowDeleteModal(false);
      setAgentToDelete(null);
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      if (selectedAgent) {
        await userService.updateUser(selectedAgent.id, formData);
        toast.success('Agent updated successfully');
      } else {
        await userService.createAgent(formData);
        toast.success('Agent created successfully');
      }
      setShowAgentForm(false);
      setSelectedAgent(null);
      await fetchAgents();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || (selectedAgent ? 'Failed to update agent' : 'Failed to create agent');
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
    <div className="min-h-screen py-2 sm:py-4 px-0 sm:px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {showAgentForm && (
          <div className="relative z-50">
            <AgentForm
              user={selectedAgent}
              agents={agents}
              setAgents={setAgents}
              onClose={() => {
                setShowAgentForm(false);
                setSelectedAgent(null);
              }}
              onSubmit={handleFormSubmit}
            />
          </div>
        )}

        {showDeleteModal && (
          <DeleteConfirmationModal
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setAgentToDelete(null);
            }}
            onConfirm={confirmDelete}
            title="Delete Agent"
            message={`Are you sure you want to delete ${agentToDelete?.name}? This action cannot be undone.`}
          />
        )}

        <div className="px-4 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Internal Users</h1>
            <button
              onClick={() => {
                setSelectedAgent(null);
                setShowAgentForm(true);
              }}
              className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Add Internal User
            </button>
          </div>

          <div className="mt-4 flex flex-col">
            <div className="-my-2 overflow-x-auto">
              <div className="py-2 align-middle inline-block min-w-full">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Departments
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Categories
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            University
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Program
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Batch
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Active
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {agents.map((agent) => (
                          <tr key={agent.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {agent.name}
                              <div className="text-xs text-gray-400">{agent.email}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {agent.role.description}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {agent.user_departments && agent.user_departments.length > 0 ? (
                                  agent.user_departments.map((ud) => (
                                    <span
                                      key={ud.department.id}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                      title={ud.department.description}
                                    >
                                      {ud.department.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">No departments</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex max-h-16 flex-wrap content-start gap-1 overflow-y-auto">
                                {agent.user_categories && agent.user_categories.length > 0 ? (
                                  agent.user_categories.map((uc) => (
                                    <span
                                      key={uc.category.id}
                                      className="inline-flex items-center whitespace-nowrap rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
                                      title={uc.category.description}
                                    >
                                      {uc.category.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">No categories</span>
                                )}
                              </div>
                            </td>
                            {/* University */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {agent.user_batches && agent.user_batches.length > 0 ? (
                                  agent.user_batches.map((ub) => (
                                    <span
                                      key={`univ-${ub.batch.id}`}
                                      className="text-sm text-gray-700 whitespace-nowrap"
                                    >
                                      {ub.batch.program?.university?.name || 'N/A'}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">N/A</span>
                                )}
                              </div>
                            </td>
                            {/* Program */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {agent.user_batches && agent.user_batches.length > 0 ? (
                                  agent.user_batches.map((ub) => (
                                    <span
                                      key={`prog-${ub.batch.id}`}
                                      className="text-sm text-gray-700 whitespace-nowrap"
                                    >
                                      {ub.batch.program?.name || 'N/A'}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">N/A</span>
                                )}
                              </div>
                            </td>
                            {/* Batch */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {agent.user_batches && agent.user_batches.length > 0 ? (
                                  agent.user_batches.map((ub) => (
                                    <span
                                      key={ub.batch.id}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 whitespace-nowrap"
                                      title={ub.batch.description}
                                    >
                                      {ub.batch.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">No batches</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {agent.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              <button 
                                onClick={() => handleEdit(agent)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(agent)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default AgentsPage;
