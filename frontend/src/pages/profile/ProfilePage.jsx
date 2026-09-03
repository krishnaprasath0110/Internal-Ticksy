import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
// import MainLayout from '../../components/layout/MainLayout';
import { Chip, Divider } from '@mui/material';
import { ROLES } from '../../utils/roles';

function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      await updateUser({
        name: formData.name,
        email: formData.email,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    }
  };

  // Helper function to render role-specific information
  const renderRoleSpecificInfo = () => {
    if (!user) return null;

    const isCandidate = user.role?.name === 'candidate';
    const isAgent = [ROLES.AGENT, ROLES.DEPARTMENT_MANAGER, ROLES.ADMIN, ROLES.DEPARTMENT_SUPERVISOR].includes(user.role?.name);

    return (
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 mt-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Role Information</h3>
            <p className="mt-1 text-sm text-gray-500">
              Details specific to your role in the system
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <div className="grid grid-cols-6 gap-6">
              <div className="col-span-6 sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="text-sm text-gray-900 bg-gray-100 rounded-md px-3 py-2">
                  {user.role?.name ? (
                    <Chip 
                      label={user.role.name.charAt(0).toUpperCase() + user.role.name.slice(1)} 
                      color="primary" 
                      variant="outlined" 
                    />
                  ) : 'Not assigned'}
                </div>
              </div>

              {isAgent && (
                <>
                  <div className="col-span-6">
                    <Divider className="my-3" />
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Departments</label>
                    <div className="flex flex-wrap gap-2">
                      {user.user_departments?.length > 0 ? (
                        user.user_departments.map((userDept) => (
                          <Chip 
                            key={userDept.department.id} 
                            label={userDept.department.name} 
                            color="success" 
                            variant="outlined"
                            className="mb-2" 
                          />
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No departments assigned</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-6">
                    <Divider className="my-3" />
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {user.user_categories?.length > 0 ? (
                        user.user_categories.map((userCat) => (
                          <Chip 
                            key={userCat.category.id} 
                            label={`${userCat.category.name} (${userCat.category.department.name})`} 
                            color="info" 
                            variant="outlined"
                            className="mb-2" 
                          />
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No categories assigned</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {isCandidate && (
                <>
                  <div className="col-span-6">
                    <Divider className="my-3" />
                    <label className="block text-sm font-medium text-gray-700 mb-1">Educational Information</label>
                    
                    {user.user_batches?.length > 0 ? (
                      user.user_batches.map((userBatch) => (
                        <div key={userBatch.batch.id} className="mb-4 bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500">University</label>
                              <p className="text-sm">{userBatch.batch.program.university.name}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Program</label>
                              <p className="text-sm">{userBatch.batch.program.name}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Batch</label>
                              <p className="text-sm">{userBatch.batch.name}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Batch Description</label>
                              <p className="text-sm">{userBatch.batch.description || 'No description'}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No educational information available</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Profile</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your Personal Information
              </p>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              {error && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  {isEditing && (
                    <>
                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                          Current Password
                        </label>
                        <input
                          type="password"
                          name="currentPassword"
                          id="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                          New Password
                        </label>
                        <input
                          type="password"
                          name="newPassword"
                          id="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          id="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* <div className="mt-6 flex justify-end space-x-3">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Save Changes
                      </button>
                    </>
                  )}
                </div> */}
              </form>
            </div>
          </div>
        </div>

        {/* Role-specific information section */}
        {renderRoleSpecificInfo()}
      </div>
  );
}

export default ProfilePage;
