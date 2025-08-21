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

    if (action === 'login' && method === 'POST') {
      const { username, password } = await request.json();
      
      const userKey = `user:${username}`;
      const userData = await this.USERS.get(userKey);
      
      if (!userData) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const user = JSON.parse(userData);
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const token = await this.generateToken(username);
      return new Response(JSON.stringify({ token, username }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'register' && method === 'POST') {
      const { username, password } = await request.json();
      
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const userKey = `user:${username}`;
      const existingUser = await this.USERS.get(userKey);
      
      if (existingUser) {
        return new Response(JSON.stringify({ error: 'Username already exists' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userData = {
        username,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      await this.USERS.put(userKey, JSON.stringify(userData));

      const token = await this.generateToken(username);
      return new Response(JSON.stringify({ token, username }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
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
      const notesData = await this.NOTES.get(notesKey);
      const notes = notesData ? JSON.parse(notesData) : [];
      
      return new Response(JSON.stringify(notes), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      // Create new note
      const { title, content } = await request.json();
      const notesKey = `notes:${username}`;
      const notesData = await this.NOTES.get(notesKey);
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
      const notesData = await this.NOTES.get(notesKey);
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
      const notesData = await this.NOTES.get(notesKey);
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
    const data = encoder.encode(username + ':' + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async authenticateRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    // In a real app, you'd validate the token properly
    // For this demo, we'll extract username from the token (simplified)
    try {
      const userKey = `token:${token}`;
      const username = await this.USERS.get(userKey);
      return username;
    } catch {
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
            --primary-600: #2563eb;
            --primary-700: #1d4ed8;
            --primary-50: #eff6ff;
            --primary-100: #dbeafe;
            --gray-50: #f9fafb;
            --gray-100: #f3f4f6;
            --gray-200: #e5e7eb;
            --gray-300: #d1d5db;
            --gray-400: #9ca3af;
            --gray-500: #6b7280;
            --gray-600: #4b5563;
            --gray-700: #374151;
            --gray-800: #1f2937;
            --gray-900: #111827;
            --red-500: #ef4444;
            --red-600: #dc2626;
            --green-500: #10b981;
            --green-600: #059669;
            --amber-500: #f59e0b;
            --amber-600: #d97706;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            --ring-primary: 0 0 0 3px rgb(37 99 235 / 0.1);
            --transition-all: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--gray-50) 0%, var(--gray-100) 100%);
            height: 100vh;
            overflow: hidden;
            color: var(--gray-900);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .app {
            display: flex;
            height: 100vh;
            backdrop-filter: blur(20px);
        }

        .sidebar {
            width: 320px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--gray-200);
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-lg);
            position: relative;
            z-index: 10;
        }

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid var(--gray-200);
            background: rgba(255, 255, 255, 0.8);
        }

        .sidebar-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: var(--gray-900);
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
            background: var(--gray-50);
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid var(--gray-200);
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
            color: var(--gray-700);
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
            background: var(--gray-100);
            color: var(--gray-700);
            border: 1px solid var(--gray-300);
        }

        .btn-secondary:hover:not(:disabled) {
            background: var(--gray-200);
            border-color: var(--gray-400);
        }

        .btn-ghost {
            background: transparent;
            color: var(--gray-600);
            border: 1px solid transparent;
        }

        .btn-ghost:hover:not(:disabled) {
            background: var(--gray-100);
            color: var(--gray-700);
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
            border: 1px solid var(--gray-300);
            border-radius: 12px;
            font-size: 14px;
            background: white;
            transition: var(--transition-all);
        }

        .notes-search input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
        }

        .notes-search i {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray-400);
            font-size: 14px;
        }

        .note-item {
            padding: 16px;
            border: 1px solid var(--gray-200);
            border-radius: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            background: white;
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
            background: var(--gray-50);
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
            color: var(--gray-900);
            font-size: 15px;
            line-height: 1.4;
            flex: 1;
        }

        .note-date {
            font-size: 11px;
            color: var(--gray-500);
            font-weight: 400;
            white-space: nowrap;
            margin-left: 12px;
        }

        .note-preview {
            font-size: 13px;
            color: var(--gray-600);
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
            background: white;
            position: relative;
        }

        .editor-header {
            padding: 24px 32px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--gray-200);
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 5;
        }

        .title-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid var(--gray-300);
            border-radius: 10px;
            font-size: 20px;
            font-weight: 600;
            background: white;
            transition: var(--transition-all);
        }

        .title-input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
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
            color: var(--gray-500);
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--gray-50);
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
            border-right: 1px solid var(--gray-200);
            background: var(--gray-50);
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
            color: var(--gray-900);
        }

        .editor textarea::placeholder {
            color: var(--gray-400);
        }

        .preview {
            background: white;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--gray-300) transparent;
        }

        .preview::-webkit-scrollbar {
            width: 8px;
        }

        .preview::-webkit-scrollbar-track {
            background: transparent;
        }

        .preview::-webkit-scrollbar-thumb {
            background-color: var(--gray-300);
            border-radius: 4px;
        }

        .preview-content {
            padding: 32px;
            max-width: none;
        }

        .preview h1, .preview h2, .preview h3, .preview h4, .preview h5, .preview h6 {
            margin-top: 32px;
            margin-bottom: 16px;
            color: var(--gray-900);
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
            color: var(--gray-700);
        }

        .preview strong {
            font-weight: 600;
            color: var(--gray-900);
        }

        .preview em {
            font-style: italic;
        }

        .preview code {
            background: var(--gray-100);
            padding: 4px 8px;
            border-radius: 6px;
            font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            color: var(--gray-800);
            border: 1px solid var(--gray-200);
        }

        .preview pre {
            background: var(--gray-900);
            color: var(--gray-100);
            padding: 24px;
            border-radius: 12px;
            overflow-x: auto;
            margin: 24px 0;
            border: 1px solid var(--gray-700);
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
            color: var(--gray-600);
            font-style: italic;
            background: var(--gray-50);
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
            color: var(--gray-700);
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
            background: white;
            padding: 40px;
            border-radius: 20px;
            width: 420px;
            max-width: 90vw;
            box-shadow: var(--shadow-xl);
            animation: slideUp 0.3s ease-out;
            border: 1px solid var(--gray-200);
        }

        .auth-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .auth-header h2 {
            font-size: 28px;
            font-weight: 700;
            color: var(--gray-900);
            margin-bottom: 8px;
        }

        .auth-header p {
            color: var(--gray-600);
            font-size: 16px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--gray-700);
            font-size: 14px;
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--gray-300);
            border-radius: 10px;
            font-size: 16px;
            transition: var(--transition-all);
            background: white;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary-600);
            box-shadow: var(--ring-primary);
        }

        .auth-tabs {
            display: flex;
            margin-bottom: 32px;
            background: var(--gray-100);
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
            color: var(--gray-600);
        }

        .auth-tab.active {
            background: white;
            color: var(--gray-900);
            box-shadow: var(--shadow-sm);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--gray-500);
            text-align: center;
            padding: 40px;
        }

        .empty-state i {
            font-size: 64px;
            margin-bottom: 24px;
            color: var(--gray-300);
        }

        .empty-state h3 {
            font-size: 24px;
            font-weight: 600;
            color: var(--gray-700);
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
                background: white;
                border-bottom: 1px solid var(--gray-200);
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .mobile-menu-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border: none;
                background: var(--gray-100);
                border-radius: 8px;
                color: var(--gray-700);
                cursor: pointer;
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
                            <textarea id="noteContent" placeholder="Start writing your note in markdown...

# Welcome to Mini Notes!

Start writing your thoughts here. You can use **markdown** syntax for formatting.

## Features
- **Bold** and *italic* text
- `Code snippets`
- Lists and more!

> This is a blockquote

Happy writing! ✨"></textarea>
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
                const response = await fetch(\`/api/auth/\${authMode}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    currentUser = data;
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', data.username);
                    showToast(\`\${authMode === 'login' ? 'Logged in' : 'Account created'} successfully!\`, 'success');
                    showApp();
                    loadNotes();
                } else {
                    showToast(data.error || 'Authentication failed', 'error');
                }
            } catch (error) {
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
                const response = await fetch('/api/notes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify({ title: 'Untitled Note', content: '' })
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