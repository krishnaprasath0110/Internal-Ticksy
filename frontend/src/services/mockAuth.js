// Mock users for development
const mockUsers = {
  admin: {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    departmentId: null,
    categoryId: null
  },
  department_manager: {
    id: 2,
    email: 'dept@example.com',
    password: 'dept123',
    name: 'Department Manager',
    role: 'department_manager',
    departmentId: 1,
    categoryId: null
  },
  category_manager: {
    id: 3,
    email: 'category@example.com',
    password: 'category123',
    name: 'Category Manager',
    role: 'category_manager',
    departmentId: 1,
    categoryId: 1
  },
  agent: {
    id: 4,
    email: 'agent@example.com',
    password: 'agent123',
    name: 'Support Agent',
    role: 'agent',
    departmentId: 1,
    categoryId: 1
  },
  user: {
    id: 5,
    email: 'user@example.com',
    password: 'user123',
    name: 'Regular User',
    role: 'user',
    departmentId: null,
    categoryId: null
  }
};

export const mockAuthService = {
  login: async (email, password) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = Object.values(mockUsers).find(u => u.email === email);
    
    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }

    // Create a mock token
    const token = btoa(JSON.stringify({ userId: user.id, role: user.role }));

    return {
      token,
      user: {
        ...user,
        password: undefined // Remove password from response
      }
    };
  },

  getMe: async (token) => {
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const decoded = JSON.parse(atob(token));
      const user = Object.values(mockUsers).find(u => u.id === decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        ...user,
        password: undefined
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
};

// Mock data for tickets
export const mockTickets = [
  {
    id: 1,
    title: 'System access issue',
    status: 'open',
    createdBy: 'user@example.com',
    assignedTo: 'agent@example.com',
    createdAt: '2025-06-21T12:00:00Z',
    category: 'Technical Support',
    department: 'IT'
  },
  {
    id: 2,
    title: 'Password reset request',
    status: 'closed',
    createdBy: 'user@example.com',
    assignedTo: 'agent@example.com',
    createdAt: '2025-06-20T15:30:00Z',
    category: 'Account Management',
    department: 'IT'
  },
  {
    id: 3,
    title: 'Feature request',
    status: 'pending',
    createdBy: 'user@example.com',
    assignedTo: null,
    createdAt: '2025-06-22T09:00:00Z',
    category: 'Feature Request',
    department: 'Product'
  }
];
