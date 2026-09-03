// Role definitions
export const ROLES = {
  ADMIN: 'admin',
  DEPARTMENT_MANAGER: 'department-manager',
  DEPARTMENT_SUPERVISOR: 'department-supervisor',
  AGENT: 'agent',
  CANDIDATE: 'candidate'
};

// Get ticket access based on role
export const getTicketAccess = (role, userData) => {
  switch(role) {
    case ROLES.ADMIN:
      return { type: 'all' };
    case ROLES.DEPARTMENT_MANAGER:
      return { type: 'department', id: userData.departmentId };
    case ROLES.DEPARTMENT_SUPERVISOR:
      return { type: 'category', id: userData.categoryId };
    case ROLES.AGENT:
      return { type: 'assigned', id: userData.id };
    default:
      return { type: 'own', id: userData.id };
  }
};

// Get dashboard widgets based on role
export const getDashboardWidgets = (role) => {
  const common = ['recentTickets'];
  
  switch(role) {
    case ROLES.ADMIN:
      return [...common, 'allStats', 'departmentStats', 'categoryStats'];
    case ROLES.DEPARTMENT_MANAGER:
      return [...common, 'departmentStats', 'categoryStats'];
    case ROLES.DEPARTMENT_SUPERVISOR:
      return [...common, 'categoryStats'];
    case ROLES.AGENT:
      return [...common, 'assignedStats'];
    default:
      return [...common, 'myTickets'];
  }
};
