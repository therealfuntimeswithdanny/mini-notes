// Mini Notes - Cloudflare Workers App
import bcrypt from 'bcryptjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

class MiniNotesApp {
  constructor(env) {
    this.NOTES = env.NOTES;
    this.USERS = env.USERS;
    
    // Debug: Log if KV namespaces are available
    console.log('KV Namespaces available:', {
      NOTES: !!this.NOTES,
      USERS: !!this.USERS
    });
    
    // For development, create in-memory storage if KV is not available
    if (!this.NOTES || !this.USERS) {
      console.warn('KV namespaces not available, using in-memory storage for development');
      this.memoryStorage = new Map();
    }
  }
  
  // Helper method to get from storage (KV or memory)
  async getFromStorage(namespace, key) {
    if (namespace) {
      return await namespace.get(key);
    } else {
      return this.memoryStorage.get(`${namespace === this.NOTES ? 'NOTES' : 'USERS'}:${key}`);
    }
  }
  
  // Helper method to put to storage (KV or memory)
  async putToStorage(namespace, key, value, options = {}) {
    if (namespace) {
      return await namespace.put(key, value, options);
    } else {
      this.memoryStorage.set(`${namespace === this.NOTES ? 'NOTES' : 'USERS'}:${key}`, value);
    }
  }
  
  // Helper method to delete from storage (KV or memory)
  async deleteFromStorage(namespace, key) {
    if (namespace) {
      return await namespace.delete(key);
    } else {
      this.memoryStorage.delete(`${namespace === this.NOTES ? 'NOTES' : 'USERS'}:${key}`);
    }
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Serve static files
    if (path === '/' || path === '/index.html') {
      return this.serveHTML();
    }

    // API routes
    if (path.startsWith('/api/')) {
      return this.handleAPI(request, path);
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  }

  async handleAPI(request, path) {
    try {
      const segments = path.split('/').filter(Boolean);
      
      if (segments[1] === 'auth') {
        return this.handleAuth(request, segments[2]);
      } else if (segments[1] === 'notes') {
        return this.handleNotes(request, segments[2]);
      }

      return new Response('API route not found', { status: 404, headers: CORS_HEADERS });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }

  async handleAuth(request, action) {
    const method = request.method;
    console.log(`Auth request: ${method} /api/auth/${action}`);

    if (action === 'login' && method === 'POST') {
      try {
        const { username, password } = await request.json();
        console.log('Login attempt for username:', username);
        
        const userKey = `user:${username}`;
        const userData = await this.getFromStorage(this.USERS, userKey);
        
        if (!userData) {
          console.log('User not found:', username);
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const user = JSON.parse(userData);
        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          console.log('Invalid password for user:', username);
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        console.log('Login successful for user:', username);
        const token = await this.generateToken(username);
        return new Response(JSON.stringify({ token, username }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ error: 'Login failed: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    if (action === 'register' && method === 'POST') {
      try {
        const { username, password } = await request.json();
        console.log('Registration attempt for username:', username);
        
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username and password required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const userKey = `user:${username}`;
        const existingUser = await this.getFromStorage(this.USERS, userKey);
        
        if (existingUser) {
          console.log('Username already exists:', username);
          return new Response(JSON.stringify({ error: 'Username already exists' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        console.log('Creating new user:', username);
        const passwordHash = await bcrypt.hash(password, 10);
        const userData = {
          username,
          passwordHash,
          createdAt: new Date().toISOString()
        };

        await this.putToStorage(this.USERS, userKey, JSON.stringify(userData));
        console.log('User created successfully:', username);

        const token = await this.generateToken(username);
        return new Response(JSON.stringify({ token, username }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Registration failed: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  async handleNotes(request, noteId) {
    const method = request.method;
    const username = await this.authenticateRequest(request);

    if (!username) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'GET' && !noteId) {
      // Get all notes for user
      const notesKey = `notes:${username}`;
      const notesData = await this.getFromStorage(this.NOTES, notesKey);
      const notes = notesData ? JSON.parse(notesData) : [];
      
      return new Response(JSON.stringify(notes), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      // Create new note
      const { title, content } = await request.json();
      const notesKey = `notes:${username}`;
      const notesData = await this.getFromStorage(this.NOTES, notesKey);
      const notes = notesData ? JSON.parse(notesData) : [];
      
      const newNote = {
        id: Date.now().toString(),
        title: title || 'Untitled Note',
        content: content || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      notes.push(newNote);
      await this.NOTES.put(notesKey, JSON.stringify(notes));

      return new Response(JSON.stringify(newNote), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PUT' && noteId) {
      // Update note
      const { title, content } = await request.json();
      const notesKey = `notes:${username}`;
      const notesData = await this.getFromStorage(this.NOTES, notesKey);
      const notes = notesData ? JSON.parse(notesData) : [];
      
      const noteIndex = notes.findIndex(note => note.id === noteId);
      if (noteIndex === -1) {
        return new Response(JSON.stringify({ error: 'Note not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      notes[noteIndex] = {
        ...notes[noteIndex],
        title: title || notes[noteIndex].title,
        content: content !== undefined ? content : notes[noteIndex].content,
        updatedAt: new Date().toISOString()
      };

      await this.NOTES.put(notesKey, JSON.stringify(notes));

      return new Response(JSON.stringify(notes[noteIndex]), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'DELETE' && noteId) {
      // Delete note
      const notesKey = `notes:${username}`;
      const notesData = await this.getFromStorage(this.NOTES, notesKey);
      const notes = notesData ? JSON.parse(notesData) : [];
      
      const filteredNotes = notes.filter(note => note.id !== noteId);
      
      if (filteredNotes.length === notes.length) {
        return new Response(JSON.stringify({ error: 'Note not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      await this.NOTES.put(notesKey, JSON.stringify(filteredNotes));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  async generateToken(username) {
    const encoder = new TextEncoder();
    const data = encoder.encode(username + ':' + Date.now() + ':' + Math.random());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Store the token in KV storage with expiration (24 hours)
    const tokenKey = `token:${token}`;
    const tokenData = {
      username: username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    await this.putToStorage(this.USERS, tokenKey, JSON.stringify(tokenData), { expirationTtl: 24 * 60 * 60 }); // 24 hours TTL
    
    return token;
  }

  async authenticateRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    try {
      const tokenKey = `token:${token}`;
      const tokenData = await this.getFromStorage(this.USERS, tokenKey);
      
      if (!tokenData) {
        return null;
      }
      
      const tokenInfo = JSON.parse(tokenData);
      
      // Check if token has expired
      if (new Date() > new Date(tokenInfo.expiresAt)) {
        // Clean up expired token
        await this.deleteFromStorage(this.USERS, tokenKey);
        return null;
      }
      
      return tokenInfo.username;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  serveHTML() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini Notes</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            /* Primary Colors */
            --primary-600: #2563eb;
            --primary-700: #1d4ed8;
            --primary-50: #eff6ff;
            --primary-100: #dbeafe;
            --primary-300: #93c5fd;
            
            /* Light Mode Colors */
            --bg-primary: #f9fafb;
            --bg-secondary: #ffffff;
            --bg-tertiary: #f3f4f6;
            --text-primary: #111827;
            --text-secondary: #374151;
            --text-tertiary: #6b7280;
            --text-muted: #9ca3af;
            --border-primary: #e5e7eb;
            --border-secondary: #d1d5db;
            --border-tertiary: #f3f4f6;
            
            /* Status Colors */
            --red-500: #ef4444;
            --red-600: #dc2626;
            --green-500: #10b981;
            --green-600: #059669;
            --amber-500: #f59e0b;
            --amber-600: #d97706;
            
            /* Shadows */
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            --ring-primary: 0 0 0 3px rgb(37 99 235 / 0.1);
            --transition-all: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        [data-theme="dark"] {
            /* Dark Mode Colors */
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #e2e8f0;
            --text-tertiary: #cbd5e1;
            --text-muted: #94a3b8;
            --border-primary: #334155;
            --border-secondary: #475569;
            --border-tertiary: #64748b;
            
            /* Dark Mode Shadows */
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.6), 0 8px 10px -6px rgb(0 0 0 / 0.5);
        }

        /* Legacy color variables for backward compatibility */
        :root {
            --gray-50: var(--bg-primary);
            --gray-100: var(--bg-tertiary);
            --gray-200: var(--border-primary);
            --gray-300: var(--border-secondary);
            --gray-400: var(--text-muted);
            --gray-500: var(--text-tertiary);
            --gray-600: var(--text-secondary);
            --gray-700: var(--text-secondary);
            --gray-800: var(--text-primary);
            --gray-900: var(--text-primary);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%);
            height: 100vh;
            overflow: hidden;
            color: var(--text-primary);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            transition: var(--transition-all);
        }

        .app {
            display: flex;
            height: 100vh;
            backdrop-filter: blur(20px);
        }

        .sidebar {
            width: 320px;
            background: var(--bg-secondary);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--border-primary);
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-lg);
            position: relative;
            z-index: 10;
            transition: var(--transition-all);
        }

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid var(--border-primary);
            background: var(--bg-secondary);
            transition: var(--transition-all);
        }

        .sidebar-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-header h1::before {
            content: "📝";
            font-size: 24px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: var(--bg-tertiary);
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid var(--border-primary);
            transition: var(--transition-all);
        }

        .user-avatar {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 14px;
        }

        .user-name {
            flex: 1;
            font-weight: 500;
            color: var(--text-secondary);
        }

        .theme-toggle {
            padding: 8px;
            border: none;
            background: var(--bg-secondary);
            border-radius: 8px;
            color: var(--text-tertiary);
            cursor: pointer;
            transition: var(--transition-all);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 1px solid var(--border-secondary);
        }

        .theme-toggle:hover {
            background: var(--border-tertiary);
            color: var(--text-primary);
            transform: scale(1.05);
        }

        .sidebar-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 20px;
        }

        .sidebar-actions .btn {
            justify-content: center;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition-all);
            position: relative;
            overflow: hidden;
            text-decoration: none;
            font-family: inherit;
        }

        .btn:focus {
            outline: none;
            box-shadow: var(--ring-primary);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .btn:not(:disabled):hover {
            transform: translateY(-1px);
        }

        .btn:not(:disabled):active {
            transform: translateY(0);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
            color: white;
            box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover:not(:disabled) {
            box-shadow: var(--shadow-md);
        }

        .btn-danger {
            background: linear-gradient(135deg, var(--red-500), var(--red-600));
            color: white;
            box-shadow: var(--shadow-sm);
        }

        .btn-danger:hover:not(:disabled) {
            box-shadow: var(--shadow-md);
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border: 1px solid var(--border-secondary);
        }

        .btn-secondary:hover:not(:disabled) {
            background: var(--border-tertiary);
            border-color: var(--border-secondary);
        }

        .btn-ghost {
            background: transparent;
            color: var(--text-tertiary);
            border: 1px solid transparent;
        }

        .btn-ghost:hover:not(:disabled) {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
        }

        .notes-list {
            flex: 1;
            overflow-y: auto;
            padding: 0 24px 24px;
            scrollbar-width: thin;
            scrollbar-color: var(--gray-300) transparent;
        }

        .notes-list::-webkit-scrollbar {
            width: 6px;
        }

        .notes-list::-webkit-scrollbar-track {
            background: transparent;
        }

        .notes-list::-webkit-scrollbar-thumb {
            background-color: var(--gray-300);
            border-radius: 3px;
        }

        .notes-search {
            position: relative;
            margin-bottom: 16px;
        }

        .notes-search input {
            width: 100%;
            padding: 12px 16px 12px 44px;
            border: 1px solid var(--border-secondary);
            border-radius: 12px;
            font-size: 14px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            transition: var(--transition-all);
        }

        .notes-search input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
        }

        .notes-search input::placeholder {
            color: var(--text-muted);
        }

        .notes-search i {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        .note-item {
            padding: 16px;
            border: 1px solid var(--border-primary);
            border-radius: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            background: var(--bg-secondary);
            transition: var(--transition-all);
            position: relative;
            overflow: hidden;
        }

        .note-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            width: 4px;
            height: 100%;
            background: transparent;
            transition: var(--transition-all);
        }

        .note-item:hover {
            background: var(--bg-tertiary);
            border-color: var(--primary-300);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        .note-item:hover::before {
            background: var(--primary-600);
        }

        .note-item.active {
            background: var(--primary-50);
            border-color: var(--primary-600);
            box-shadow: var(--shadow-md);
        }

        [data-theme="dark"] .note-item.active {
            background: var(--bg-tertiary);
        }

        .note-item.active::before {
            background: var(--primary-600);
        }

        .note-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .note-title {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 15px;
            line-height: 1.4;
            flex: 1;
        }

        .note-date {
            font-size: 11px;
            color: var(--text-tertiary);
            font-weight: 400;
            white-space: nowrap;
            margin-left: 12px;
        }

        .note-preview {
            font-size: 13px;
            color: var(--text-tertiary);
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-secondary);
            position: relative;
            transition: var(--transition-all);
        }

        .editor-header {
            padding: 24px 32px;
            background: var(--bg-secondary);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-primary);
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 5;
            transition: var(--transition-all);
        }

        .title-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid var(--border-secondary);
            border-radius: 10px;
            font-size: 20px;
            font-weight: 600;
            background: var(--bg-secondary);
            color: var(--text-primary);
            transition: var(--transition-all);
        }

        .title-input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
        }

        .title-input::placeholder {
            color: var(--text-muted);
        }

        .editor-toolbar {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .save-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: var(--text-tertiary);
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--bg-tertiary);
            transition: var(--transition-all);
        }

        .save-status.saving {
            color: var(--amber-600);
        }

        .save-status.saved {
            color: var(--green-600);
        }

        .editor-container {
            flex: 1;
            display: flex;
            position: relative;
        }

        .editor, .preview {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .editor {
            border-right: 1px solid var(--border-primary);
            background: var(--bg-tertiary);
            transition: var(--transition-all);
        }

        .editor-content {
            flex: 1;
            padding: 32px;
            display: flex;
            flex-direction: column;
        }

        .editor textarea {
            flex: 1;
            border: none;
            outline: none;
            font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 15px;
            line-height: 1.7;
            resize: none;
            background: transparent;
            color: var(--text-primary);
            transition: var(--transition-all);
        }

        .editor textarea::placeholder {
            color: var(--text-muted);
        }

        .preview {
            background: var(--bg-secondary);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--border-secondary) transparent;
            transition: var(--transition-all);
        }

        .preview::-webkit-scrollbar {
            width: 8px;
        }

        .preview::-webkit-scrollbar-track {
            background: transparent;
        }

        .preview::-webkit-scrollbar-thumb {
            background-color: var(--border-secondary);
            border-radius: 4px;
        }

        .preview-content {
            padding: 32px;
            max-width: none;
        }

        .preview h1, .preview h2, .preview h3, .preview h4, .preview h5, .preview h6 {
            margin-top: 32px;
            margin-bottom: 16px;
            color: var(--text-primary);
            font-weight: 700;
            line-height: 1.3;
        }

        .preview h1:first-child,
        .preview h2:first-child,
        .preview h3:first-child {
            margin-top: 0;
        }

        .preview h1 { font-size: 32px; }
        .preview h2 { font-size: 26px; }
        .preview h3 { font-size: 22px; }
        .preview h4 { font-size: 18px; }
        .preview h5 { font-size: 16px; }
        .preview h6 { font-size: 14px; }

        .preview p {
            margin-bottom: 20px;
            line-height: 1.7;
            color: var(--text-secondary);
        }

        .preview strong {
            font-weight: 600;
            color: var(--text-primary);
        }

        .preview em {
            font-style: italic;
        }

        .preview code {
            background: var(--bg-tertiary);
            padding: 4px 8px;
            border-radius: 6px;
            font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            color: var(--text-primary);
            border: 1px solid var(--border-primary);
        }

        .preview pre {
            background: var(--text-primary);
            color: var(--bg-secondary);
            padding: 24px;
            border-radius: 12px;
            overflow-x: auto;
            margin: 24px 0;
            border: 1px solid var(--border-primary);
        }

        [data-theme="dark"] .preview pre {
            background: #000000;
            color: #f8f8f2;
        }

        .preview pre code {
            background: none;
            padding: 0;
            border: none;
            color: inherit;
        }

        .preview blockquote {
            border-left: 4px solid var(--primary-600);
            padding-left: 20px;
            margin: 24px 0;
            color: var(--text-tertiary);
            font-style: italic;
            background: var(--bg-tertiary);
            padding: 20px;
            border-radius: 8px;
        }

        .preview ul, .preview ol {
            margin: 16px 0;
            padding-left: 24px;
        }

        .preview li {
            margin-bottom: 8px;
            line-height: 1.6;
            color: var(--text-secondary);
        }

        .auth-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from { 
                opacity: 0; 
                transform: translateY(20px);
            }
            to { 
                opacity: 1; 
                transform: translateY(0);
            }
        }

        .auth-form {
            background: var(--bg-secondary);
            padding: 40px;
            border-radius: 20px;
            width: 420px;
            max-width: 90vw;
            box-shadow: var(--shadow-xl);
            animation: slideUp 0.3s ease-out;
            border: 1px solid var(--border-primary);
            transition: var(--transition-all);
        }

        .auth-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .auth-header h2 {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .auth-header p {
            color: var(--text-tertiary);
            font-size: 16px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--text-secondary);
            font-size: 14px;
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--border-secondary);
            border-radius: 10px;
            font-size: 16px;
            transition: var(--transition-all);
            background: var(--bg-secondary);
            color: var(--text-primary);
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
        }

        .form-group input::placeholder {
            color: var(--text-muted);
        }

        .auth-tabs {
            display: flex;
            margin-bottom: 32px;
            background: var(--bg-tertiary);
            border-radius: 12px;
            padding: 4px;
        }

        .auth-tab {
            flex: 1;
            padding: 12px 16px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            border-radius: 8px;
            transition: var(--transition-all);
            color: var(--text-tertiary);
        }

        .auth-tab.active {
            background: var(--bg-secondary);
            color: var(--text-primary);
            box-shadow: var(--shadow-sm);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-tertiary);
            text-align: center;
            padding: 40px;
        }

        .empty-state i {
            font-size: 64px;
            margin-bottom: 24px;
            color: var(--text-muted);
        }

        .empty-state h3 {
            font-size: 24px;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }

        .empty-state p {
            font-size: 16px;
            max-width: 400px;
            line-height: 1.6;
        }

        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--gray-900);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 1001;
            animation: slideUp 0.3s ease-out;
            max-width: 400px;
        }

        .toast.success {
            background: var(--green-600);
        }

        .toast.error {
            background: var(--red-600);
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                position: fixed;
                left: -100%;
                z-index: 1000;
                transition: left 0.3s ease;
            }

            .sidebar.open {
                left: 0;
            }

            .app {
                position: relative;
            }

            .mobile-header {
                display: flex;
                align-items: center;
                justify-content: between;
                padding: 16px 20px;
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-primary);
                position: sticky;
                top: 0;
                z-index: 10;
                transition: var(--transition-all);
            }

            .mobile-menu-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border: none;
                background: var(--bg-tertiary);
                border-radius: 8px;
                color: var(--text-secondary);
                cursor: pointer;
                transition: var(--transition-all);
            }

            .mobile-menu-btn:hover {
                background: var(--border-tertiary);
                color: var(--text-primary);
            }

            .editor-container {
                flex-direction: column;
            }

            .editor, .preview {
                min-height: 50vh;
            }

            .editor {
                border-right: none;
                border-bottom: 1px solid var(--gray-200);
            }
        }

        @media (min-width: 769px) {
            .mobile-header {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div id="authModal" class="auth-modal">
        <div class="auth-form">
            <div class="auth-header">
                <h2 id="authTitle">Welcome Back</h2>
                <p id="authSubtitle">Sign in to your account to continue</p>
            </div>
            <div class="auth-tabs">
                <button class="auth-tab active" onclick="switchTab('login')">Login</button>
                <button class="auth-tab" onclick="switchTab('register')">Register</button>
            </div>
            <form id="authForm">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" required placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required placeholder="Enter your password">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;" id="authSubmitBtn">
                    <span id="authButtonText">Login</span>
                    <div class="loading-spinner" id="authSpinner" style="display: none;"></div>
                </button>
            </form>
        </div>
    </div>

    <div class="app" id="app" style="display: none;">
        <!-- Mobile Header -->
        <div class="mobile-header">
            <button class="mobile-menu-btn" onclick="toggleMobileSidebar()">
                <i class="fas fa-bars"></i>
            </button>
            <h1 style="flex: 1; text-align: center; font-size: 20px; font-weight: 600;">Mini Notes</h1>
        </div>

        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <h1>Mini Notes</h1>
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar">U</div>
                    <div class="user-name" id="userName">User</div>
                    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">
                        <i class="fas fa-moon" id="themeIcon"></i>
                    </button>
                    <button class="btn btn-ghost" onclick="logout()" style="padding: 6px;">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
                <div class="sidebar-actions">
                    <button class="btn btn-primary" onclick="createNote()">
                        <i class="fas fa-plus"></i>
                        Add
                    </button>
                    <button class="btn btn-secondary" onclick="renameNote()" id="renameBtn" disabled>
                        <i class="fas fa-edit"></i>
                        Rename
                    </button>
                </div>
                <div class="sidebar-actions">
                    <button class="btn btn-danger" onclick="deleteNote()" id="deleteBtn" disabled style="grid-column: 1 / -1;">
                        <i class="fas fa-trash"></i>
                        Delete Note
                    </button>
                </div>
            </div>
            <div class="notes-list" id="notesList">
                <div class="notes-search">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Search notes..." id="searchInput" onkeyup="searchNotes()">
                </div>
                <!-- Notes will be populated here -->
            </div>
        </div>

        <div class="main-content">
            <div id="emptyState" class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <h3>No note selected</h3>
                <p>Select a note from the sidebar or create a new one to start writing.</p>
            </div>
            <div id="editorSection" style="display: none; flex: 1; flex-direction: column;">
                <div class="editor-header">
                    <input type="text" class="title-input" id="noteTitle" placeholder="Note title...">
                    <div class="editor-toolbar">
                        <div class="save-status" id="saveStatus">
                            <i class="fas fa-check-circle"></i>
                            <span>Saved</span>
                        </div>
                    </div>
                </div>
                <div class="editor-container">
                    <div class="editor">
                        <div class="editor-content">
                            <textarea id="noteContent" placeholder="Start writing your note in markdown..."></textarea>
                        </div>
                    </div>
                    <div class="preview">
                        <div class="preview-content" id="preview">
                            <!-- Markdown preview will appear here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="toastContainer"></div>

    <script>
        let currentUser = null;
        let currentNote = null;
        let notes = [];
        let filteredNotes = [];
        let authMode = 'login';
        let saveTimeout;
        let isLoading = false;

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize theme
            initializeTheme();
            
            const token = localStorage.getItem('token');
            const username = localStorage.getItem('username');
            
            if (token && username) {
                currentUser = { token, username };
                showApp();
                loadNotes();
            } else {
                showAuth();
            }

            // Initialize keyboard shortcuts
            document.addEventListener('keydown', handleKeyboardShortcuts);
        });

        function initializeTheme() {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = savedTheme || (prefersDark ? 'dark' : 'light');
            
            setTheme(theme);
        }

        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            
            const themeIcon = document.getElementById('themeIcon');
            if (themeIcon) {
                if (theme === 'dark') {
                    themeIcon.className = 'fas fa-sun';
                } else {
                    themeIcon.className = 'fas fa-moon';
                }
            }
            
            localStorage.setItem('theme', theme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            
            showToast(\`Switched to \${newTheme} mode\`, 'success');
        }

        function handleKeyboardShortcuts(event) {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'n':
                        event.preventDefault();
                        createNote();
                        break;
                    case 's':
                        event.preventDefault();
                        saveNote();
                        break;
                    case 'f':
                        event.preventDefault();
                        document.getElementById('searchInput').focus();
                        break;
                    case 'd':
                        event.preventDefault();
                        toggleTheme();
                        break;
                }
            }
        }

        function switchTab(mode) {
            authMode = mode;
            const tabs = document.querySelectorAll('.auth-tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            
            const authTitle = document.getElementById('authTitle');
            const authSubtitle = document.getElementById('authSubtitle');
            const authButtonText = document.getElementById('authButtonText');
            
            if (mode === 'login') {
                authTitle.textContent = 'Welcome Back';
                authSubtitle.textContent = 'Sign in to your account to continue';
                authButtonText.textContent = 'Login';
            } else {
                authTitle.textContent = 'Create Account';
                authSubtitle.textContent = 'Sign up for a new account';
                authButtonText.textContent = 'Register';
            }
        }

        async function handleAuth(event) {
            event.preventDefault();
            if (isLoading) return;
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            setLoadingState(true);

            try {
                console.log('Attempting authentication:', { authMode, username });
                
                const response = await fetch(\`/api/auth/\${authMode}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                console.log('Auth response status:', response.status);
                
                const data = await response.json();
                console.log('Auth response data:', data);

                if (response.ok) {
                    currentUser = data;
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', data.username);
                    showToast(\`\${authMode === 'login' ? 'Logged in' : 'Account created'} successfully!\`, 'success');
                    showApp();
                    loadNotes();
                } else {
                    showToast(data.error || 'Authentication failed', 'error');
                    console.error('Auth failed:', data);
                }
            } catch (error) {
                console.error('Auth error:', error);
                showToast('Network error: ' + error.message, 'error');
            } finally {
                setLoadingState(false);
            }
        }

        function setLoadingState(loading) {
            isLoading = loading;
            const submitBtn = document.getElementById('authSubmitBtn');
            const spinner = document.getElementById('authSpinner');
            const buttonText = document.getElementById('authButtonText');
            
            if (loading) {
                submitBtn.disabled = true;
                spinner.style.display = 'inline-block';
                buttonText.style.opacity = '0.7';
            } else {
                submitBtn.disabled = false;
                spinner.style.display = 'none';
                buttonText.style.opacity = '1';
            }
        }

        function showAuth() {
            document.getElementById('authModal').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
            document.getElementById('username').focus();
        }

        function showApp() {
            document.getElementById('authModal').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            if (currentUser) {
                document.getElementById('userName').textContent = currentUser.username;
                document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
            }
        }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            currentUser = null;
            currentNote = null;
            notes = [];
            filteredNotes = [];
            showAuth();
            showToast('Logged out successfully', 'success');
        }

        function toggleMobileSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
        }

        async function loadNotes() {
            try {
                const response = await fetch('/api/notes', {
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });

                if (response.ok) {
                    notes = await response.json();
                    filteredNotes = [...notes];
                    renderNotesList();
                } else {
                    console.error('Failed to load notes');
                    showToast('Failed to load notes', 'error');
                }
            } catch (error) {
                console.error('Error loading notes:', error);
                showToast('Error loading notes', 'error');
            }
        }

        function searchNotes() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            
            if (!searchTerm) {
                filteredNotes = [...notes];
            } else {
                filteredNotes = notes.filter(note => 
                    note.title.toLowerCase().includes(searchTerm) ||
                    note.content.toLowerCase().includes(searchTerm)
                );
            }
            
            renderNotesList();
        }

        function renderNotesList() {
            const notesList = document.getElementById('notesList');
            const searchContainer = notesList.querySelector('.notes-search');
            notesList.innerHTML = '';
            notesList.appendChild(searchContainer);

            if (filteredNotes.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-state';
                emptyMessage.style.height = '200px';
                emptyMessage.innerHTML = \`
                    <i class="fas fa-search"></i>
                    <h3>No notes found</h3>
                    <p>Try adjusting your search or create a new note.</p>
                \`;
                notesList.appendChild(emptyMessage);
                return;
            }

            filteredNotes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note-item';
                if (currentNote && currentNote.id === note.id) {
                    noteElement.classList.add('active');
                }
                
                const createdDate = new Date(note.createdAt);
                const updatedDate = new Date(note.updatedAt);
                const displayDate = updatedDate > createdDate ? updatedDate : createdDate;
                const dateString = formatDate(displayDate);
                
                noteElement.innerHTML = \`
                    <div class="note-header">
                        <div class="note-title">\${note.title}</div>
                        <div class="note-date">\${dateString}</div>
                    </div>
                    <div class="note-preview">\${stripMarkdown(note.content).substring(0, 100)}\${note.content.length > 100 ? '...' : ''}</div>
                \`;
                
                noteElement.onclick = () => selectNote(note);
                notesList.appendChild(noteElement);
            });
        }

        function formatDate(date) {
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) return 'Today';
            if (diffDays === 2) return 'Yesterday';
            if (diffDays <= 7) return \`\${diffDays - 1} days ago\`;
            
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }

        function stripMarkdown(text) {
            return text
                .replace(/^#+\s+/gm, '')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/\`(.*?)\`/g, '$1')
                .replace(/^>\s+/gm, '')
                .replace(/\n/g, ' ')
                .trim();
        }

        function selectNote(note) {
            currentNote = note;
            document.getElementById('noteTitle').value = note.title;
            document.getElementById('noteContent').value = note.content;
            
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('editorSection').style.display = 'flex';
            
            document.getElementById('renameBtn').disabled = false;
            document.getElementById('deleteBtn').disabled = false;
            
            renderNotesList();
            updatePreview();
            
            // Close mobile sidebar after selection
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        }

        async function createNote() {
            try {
                setSaveStatus('saving');
                
                // Create welcome content for new notes
                const welcomeContent = notes.length === 0 ? 
                    \`# Welcome to Mini Notes!

Start writing your thoughts here. You can use **markdown** syntax for formatting.

## Features
- **Bold** and *italic* text
- \\\`Code snippets\\\`
- Lists and more!

> This is a blockquote

Happy writing! ✨\` : '';

                const response = await fetch('/api/notes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify({ 
                        title: notes.length === 0 ? 'Welcome to Mini Notes' : 'Untitled Note', 
                        content: welcomeContent 
                    })
                });

                if (response.ok) {
                    const newNote = await response.json();
                    notes.unshift(newNote);
                    filteredNotes = [...notes];
                    selectNote(newNote);
                    setSaveStatus('saved');
                    showToast('New note created', 'success');
                    
                    // Focus on title input
                    setTimeout(() => {
                        document.getElementById('noteTitle').focus();
                        document.getElementById('noteTitle').select();
                    }, 100);
                } else {
                    setSaveStatus('error');
                    showToast('Failed to create note', 'error');
                }
            } catch (error) {
                setSaveStatus('error');
                showToast('Error creating note: ' + error.message, 'error');
            }
        }

        async function saveNote() {
            if (!currentNote) return;

            const title = document.getElementById('noteTitle').value.trim() || 'Untitled Note';
            const content = document.getElementById('noteContent').value;

            setSaveStatus('saving');

            try {
                const response = await fetch(\`/api/notes/\${currentNote.id}\`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify({ title, content })
                });

                if (response.ok) {
                    const updatedNote = await response.json();
                    const noteIndex = notes.findIndex(n => n.id === currentNote.id);
                    if (noteIndex !== -1) {
                        notes[noteIndex] = updatedNote;
                        currentNote = updatedNote;
                        filteredNotes = [...notes];
                        renderNotesList();
                    }
                    setSaveStatus('saved');
                } else {
                    setSaveStatus('error');
                }
            } catch (error) {
                setSaveStatus('error');
                console.error('Error saving note:', error);
            }
        }

        function setSaveStatus(status) {
            const saveStatus = document.getElementById('saveStatus');
            const icon = saveStatus.querySelector('i');
            const text = saveStatus.querySelector('span');
            
            saveStatus.className = \`save-status \${status}\`;
            
            switch (status) {
                case 'saving':
                    icon.className = 'loading-spinner';
                    text.textContent = 'Saving...';
                    break;
                case 'saved':
                    icon.className = 'fas fa-check-circle';
                    text.textContent = 'Saved';
                    break;
                case 'error':
                    icon.className = 'fas fa-exclamation-circle';
                    text.textContent = 'Error';
                    break;
            }
        }

        async function deleteNote() {
            if (!currentNote) return;
            
            const confirmed = confirm(\`Are you sure you want to delete "\${currentNote.title}"?\`);
            if (!confirmed) return;

            try {
                const response = await fetch(\`/api/notes/\${currentNote.id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });

                if (response.ok) {
                    notes = notes.filter(n => n.id !== currentNote.id);
                    filteredNotes = [...notes];
                    currentNote = null;
                    
                    document.getElementById('emptyState').style.display = 'flex';
                    document.getElementById('editorSection').style.display = 'none';
                    document.getElementById('renameBtn').disabled = true;
                    document.getElementById('deleteBtn').disabled = true;
                    
                    renderNotesList();
                    showToast('Note deleted', 'success');
                } else {
                    showToast('Failed to delete note', 'error');
                }
            } catch (error) {
                showToast('Error deleting note: ' + error.message, 'error');
            }
        }

        function renameNote() {
            if (!currentNote) return;
            
            const newTitle = prompt('Enter new title:', currentNote.title);
            if (newTitle && newTitle.trim() && newTitle !== currentNote.title) {
                document.getElementById('noteTitle').value = newTitle.trim();
                autoSave();
                showToast('Note renamed', 'success');
            }
        }

        function updatePreview() {
            const content = document.getElementById('noteContent').value;
            const preview = document.getElementById('preview');
            preview.innerHTML = markdownToHtml(content);
        }

        function markdownToHtml(markdown) {
            if (!markdown) return '<p style="color: var(--gray-400); font-style: italic;">Start typing to see preview...</p>';
            
            return markdown
                // Headers
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                // Bold and italic
                .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                // Code
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/gim, '<pre><code>$1</code></pre>')
                .replace(/\`(.*?)\`/gim, '<code>$1</code>')
                // Blockquotes
                .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
                // Lists
                .replace(/^[-*+] (.*$)/gim, '<li>$1</li>')
                .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
                .replace(/<\/ul>\\s*<ul>/gim, '')
                // Line breaks
                .replace(/\n\n/gim, '</p><p>')
                .replace(/\n/gim, '<br>')
                // Wrap in paragraphs
                .replace(/^(?!<[hul]|<blockquote|<pre)/gim, '<p>')
                .replace(/(?<!>)$/gim, '</p>')
                // Clean up empty paragraphs
                .replace(/<p><\/p>/gim, '')
                .replace(/<p>(<[hul])/gim, '$1')
                .replace(/(<\/[hul]>)<\/p>/gim, '$1');
        }

        function showToast(message, type = 'info') {
            const toastContainer = document.getElementById('toastContainer');
            
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.innerHTML = \`
                <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                \${message}
            \`;
            
            toastContainer.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => toastContainer.removeChild(toast), 300);
            }, 3000);
        }

        // Auto-save functionality
        function autoSave() {
            clearTimeout(saveTimeout);
            setSaveStatus('saving');
            saveTimeout = setTimeout(() => {
                saveNote();
            }, 1000);
        }

        // Event listeners
        document.getElementById('authForm').addEventListener('submit', handleAuth);
        document.getElementById('noteTitle').addEventListener('input', autoSave);
        document.getElementById('noteContent').addEventListener('input', function() {
            updatePreview();
            autoSave();
        });

        // Handle window resize for mobile responsiveness
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });

        // Add fadeOut animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/html' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const app = new MiniNotesApp(env);
    return app.handleRequest(request);
  },
};