import { Router } from './router';
import { AuthController } from './controllers/auth';
import { NotesController } from './controllers/notes';
import { StaticController } from './controllers/static';

export interface Env {
  NOTES: KVNamespace;
  USERS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = new Router();
    
    // Initialize controllers
    const authController = new AuthController(env);
    const notesController = new NotesController(env);
    const staticController = new StaticController();
    
    // Auth routes
    router.post('/api/auth/login', (req) => authController.login(req));
    router.post('/api/auth/register', (req) => authController.register(req));
    
    // Notes routes
    router.get('/api/notes', (req) => notesController.getNotes(req));
    router.post('/api/notes', (req) => notesController.createNote(req));
    router.put('/api/notes/:id', (req) => notesController.updateNote(req));
    router.delete('/api/notes/:id', (req) => notesController.deleteNote(req));
    
    // Static file serving
    router.get('/', () => staticController.serveIndex());
    router.get('/index.html', () => staticController.serveIndex());
    
    // Handle the request
    try {
      return await router.handle(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
  }
};