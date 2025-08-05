// Welcome to Studio - Modern Code Editor
// This is an example TypeScript file to demonstrate the editor's capabilities

interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

class UserManager {
  private users: User[] = [];

  constructor() {
    this.loadUsers();
  }

  /**
   * Add a new user to the system
   * @param user - The user object to add
   * @returns The added user with generated ID
   */
  addUser(user: Omit<User, 'id'>): User {
    const newUser: User = {
      ...user,
      id: this.generateId(),
    };

    this.users.push(newUser);
    this.saveUsers();
    
    return newUser;
  }

  /**
   * Find a user by their email address
   * @param email - The email to search for
   * @returns The user if found, undefined otherwise
   */
  findUserByEmail(email: string): User | undefined {
    return this.users.find(user => user.email === email);
  }

  /**
   * Get all active users
   * @returns Array of active users
   */
  getActiveUsers(): User[] {
    return this.users.filter(user => user.isActive);
  }

  /**
   * Update user status
   * @param userId - The ID of the user to update
   * @param isActive - The new active status
   */
  updateUserStatus(userId: number, isActive: boolean): void {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.isActive = isActive;
      this.saveUsers();
    }
  }

  private generateId(): number {
    return Math.max(...this.users.map(u => u.id), 0) + 1;
  }

  private async loadUsers(): Promise<void> {
    try {
      // In a real application, this would load from a database or API
      const mockUsers: User[] = [
        { id: 1, name: 'John Doe', email: 'john@example.com', isActive: true },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', isActive: true },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', isActive: false },
      ];
      
      this.users = mockUsers;
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  private async saveUsers(): Promise<void> {
    try {
      // In a real application, this would save to a database or API
      console.log('Saving users:', this.users);
    } catch (error) {
      console.error('Failed to save users:', error);
    }
  }
}

// Usage example
const userManager = new UserManager();

// Add a new user
const newUser = userManager.addUser({
  name: 'Alice Williams',
  email: 'alice@example.com',
  isActive: true,
});

console.log('Added user:', newUser);

// Find user by email
const foundUser = userManager.findUserByEmail('john@example.com');
if (foundUser) {
  console.log('Found user:', foundUser.name);
}

// Get all active users
const activeUsers = userManager.getActiveUsers();
console.log('Active users:', activeUsers.length);

// Demonstrate some modern TypeScript features
type UserRole = 'admin' | 'user' | 'guest';

interface ExtendedUser extends User {
  role: UserRole;
  lastLogin?: Date;
}

const createExtendedUser = (baseUser: User, role: UserRole): ExtendedUser => ({
  ...baseUser,
  role,
  lastLogin: new Date(),
});

// Using optional chaining and nullish coalescing
const getUserDisplayName = (user: ExtendedUser | null): string => {
  return user?.name ?? 'Unknown User';
};

export { UserManager, type User, type ExtendedUser, type UserRole };
