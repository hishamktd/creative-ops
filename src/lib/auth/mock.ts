/**
 * Mock authentication service for development
 * Use this when Supabase is not available or for demo purposes
 */

export interface MockUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: MockUser;
}

class MockAuthService {
  private currentUser: MockUser | null = null;
  private currentSession: MockSession | null = null;

  async signIn(email: string, password: string): Promise<{ data: { session: MockSession } | null; error: any }> {
    // Mock authentication - accept demo credentials
    if (email === 'admin@demo.com' && password === 'demo123') {
      const user: MockUser = {
        id: 'mock-user-id-123',
        email: 'admin@demo.com',
        role: 'admin',
        created_at: new Date().toISOString()
      };

      const session: MockSession = {
        access_token: 'mock-access-token-' + Date.now(),
        refresh_token: 'mock-refresh-token-' + Date.now(),
        expires_in: 3600,
        user
      };

      this.currentUser = user;
      this.currentSession = session;

      return { data: { session }, error: null };
    }

    return { 
      data: null, 
      error: { message: 'Invalid credentials' } 
    };
  }

  async signOut(): Promise<{ error: any }> {
    this.currentUser = null;
    this.currentSession = null;
    return { error: null };
  }

  async getSession(): Promise<{ data: { session: MockSession | null }; error: any }> {
    return { 
      data: { session: this.currentSession }, 
      error: null 
    };
  }

  async getUser(): Promise<{ data: { user: MockUser | null }; error: any }> {
    return { 
      data: { user: this.currentUser }, 
      error: null 
    };
  }

  // Mock the auth state change listener
  onAuthStateChange(callback: (event: string, session: MockSession | null) => void) {
    // Return a mock unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  }
}

export const mockAuth = new MockAuthService();

// Mock API endpoint response for /auth/v1/token
export function createMockTokenResponse(email: string, password: string) {
  if (email === 'admin@demo.com' && password === 'demo123') {
    return {
      access_token: 'mock-access-token-' + Date.now(),
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token-' + Date.now(),
      user: {
        id: 'mock-user-id-123',
        email: 'admin@demo.com',
        role: 'authenticated',
        created_at: new Date().toISOString()
      }
    };
  }
  
  throw new Error('Invalid credentials');
}