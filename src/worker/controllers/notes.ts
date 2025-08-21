import { Env } from '../index';

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  content: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
}

export class NotesController {
  constructor(private env: Env) {}

  async getNotes(request: Request): Promise<Response> {
    try {
      const userId = await this.authenticateRequest(request);
      if (!userId) {
        return this.errorResponse('Unauthorized', 401);
      }

      // Get all notes for the user
      const notes: Note[] = [];
      const userNotesKey = `user:${userId}:notes`;
      
      // List all notes for the user
      const noteIds = await this.env.NOTES.list({ prefix: userNotesKey });
      
      for (const key of noteIds.keys) {
        const note = await this.env.NOTES.get(key.name, 'json') as Note;
        if (note) {
          notes.push(note);
        }
      }

      // Sort by updated date (newest first)
      notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return this.jsonResponse({ notes });
    } catch (error) {
      console.error('Get notes error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  async createNote(request: Request): Promise<Response> {
    try {
      const userId = await this.authenticateRequest(request);
      if (!userId) {
        return this.errorResponse('Unauthorized', 401);
      }

      const body: CreateNoteRequest = await request.json();
      
      if (!body.title || !body.content) {
        return this.errorResponse('Title and content are required', 400);
      }

      const note: Note = {
        id: crypto.randomUUID(),
        userId,
        title: body.title,
        content: body.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store note with user-specific key
      const noteKey = `user:${userId}:notes:${note.id}`;
      await this.env.NOTES.put(noteKey, JSON.stringify(note));

      return this.jsonResponse({ note }, 201);
    } catch (error) {
      console.error('Create note error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  async updateNote(request: Request): Promise<Response> {
    try {
      const userId = await this.authenticateRequest(request);
      if (!userId) {
        return this.errorResponse('Unauthorized', 401);
      }

      // Extract note ID from URL
      const url = new URL(request.url);
      const noteId = url.pathname.split('/').pop();
      
      if (!noteId) {
        return this.errorResponse('Note ID is required', 400);
      }

      const body: UpdateNoteRequest = await request.json();
      
      if (!body.title && !body.content) {
        return this.errorResponse('At least title or content must be provided', 400);
      }

      // Get existing note
      const noteKey = `user:${userId}:notes:${noteId}`;
      const existingNote = await this.env.NOTES.get(noteKey, 'json') as Note | null;
      
      if (!existingNote) {
        return this.errorResponse('Note not found', 404);
      }

      // Update note
      const updatedNote: Note = {
        ...existingNote,
        title: body.title ?? existingNote.title,
        content: body.content ?? existingNote.content,
        updatedAt: new Date().toISOString()
      };

      await this.env.NOTES.put(noteKey, JSON.stringify(updatedNote));

      return this.jsonResponse({ note: updatedNote });
    } catch (error) {
      console.error('Update note error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  async deleteNote(request: Request): Promise<Response> {
    try {
      const userId = await this.authenticateRequest(request);
      if (!userId) {
        return this.errorResponse('Unauthorized', 401);
      }

      // Extract note ID from URL
      const url = new URL(request.url);
      const noteId = url.pathname.split('/').pop();
      
      if (!noteId) {
        return this.errorResponse('Note ID is required', 400);
      }

      // Check if note exists and belongs to user
      const noteKey = `user:${userId}:notes:${noteId}`;
      const existingNote = await this.env.NOTES.get(noteKey, 'json') as Note | null;
      
      if (!existingNote) {
        return this.errorResponse('Note not found', 404);
      }

      // Delete note
      await this.env.NOTES.delete(noteKey);

      return this.jsonResponse({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Delete note error:', error);
      return this.errorResponse('Internal server error', 500);
    }
  }

  private async authenticateRequest(request: Request): Promise<string | null> {
    try {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.slice(7);
      
      // Simple token validation - in production, use proper JWT validation
      // For now, we'll extract the user ID from the token
      try {
        const decoded = atob(token);
        const [userId] = decoded.split(':');
        return userId || null;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
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