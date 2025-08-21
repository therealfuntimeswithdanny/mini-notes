import bcrypt from 'bcryptjs';
import { Env } from '../index';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export class AuthController {
  constructor(private env: Env) {}

  async login(request: Request): Promise<Response> {
    try {
      const body: LoginRequest = await request.json();
      
      if (!body.username || !body.password) {
        return this.errorResponse('Username and password are required', 400);
      }

      // Get user from storage
      const user = await this.env.USERS.get(body.username, 'json') as User | null;
      
      if (!user) {
        return this.errorResponse('Invalid credentials', 401);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
      
      if (!isValidPassword) {
        return this.errorResponse('Invalid credentials', 401);
      }

      // Generate token (simple hash for now, could use JWT)
      const token = await this.generateToken(user.id);
      
      const response: AuthResponse = {
        token,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt
        }
      };

      return this.jsonResponse(response);
    } catch (error) {
      console.error('Login error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  async register(request: Request): Promise<Response> {
    try {
      const body: RegisterRequest = await request.json();
      
      if (!body.username || !body.password) {
        return this.errorResponse('Username and password are required', 400);
      }

      if (body.password.length < 6) {
        return this.errorResponse('Password must be at least 6 characters', 400);
      }

      // Check if user already exists
      const existingUser = await this.env.USERS.get(body.username);
      
      if (existingUser) {
        return this.errorResponse('Username already exists', 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 12);
      
      // Create user
      const user: User = {
        id: crypto.randomUUID(),
        username: body.username,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      // Store user
      await this.env.USERS.put(body.username, JSON.stringify(user));
      
      // Generate token
      const token = await this.generateToken(user.id);
      
      const response: AuthResponse = {
        token,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt
        }
      };

      return this.jsonResponse(response, 201);
    } catch (error) {
      console.error('Register error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  private async generateToken(userId: string): Promise<string> {
    // Simple token generation - in production, use JWT
    const timestamp = Date.now().toString();
    const random = crypto.randomUUID();
    return btoa(`${userId}:${timestamp}:${random}`);
  }

  private jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  private errorResponse(message: string, status: number): Response {
    return this.jsonResponse({ error: message }, status);
  }
}