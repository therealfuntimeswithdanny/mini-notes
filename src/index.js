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
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            height: 100vh;
            overflow: hidden;
        }

        .app {
            display: flex;
            height: 100vh;
        }

        .sidebar {
            width: 280px;
            background: white;
            border-right: 1px solid #e9ecef;
            display: flex;
            flex-direction: column;
        }

        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
        }

        .sidebar-header h1 {
            font-size: 24px;
            color: #343a40;
            margin-bottom: 16px;
        }

        .sidebar-actions {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-primary {
            background: #007bff;
            color: white;
        }

        .btn-primary:hover {
            background: #0056b3;
        }

        .btn-danger {
            background: #dc3545;
            color: white;
        }

        .btn-danger:hover {
            background: #c82333;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background: #545b62;
        }

        .notes-list {
            flex: 1;
            overflow-y: auto;
            padding: 0 20px 20px;
        }

        .note-item {
            padding: 12px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
            background: white;
            transition: all 0.2s;
        }

        .note-item:hover {
            background: #f8f9fa;
            border-color: #007bff;
        }

        .note-item.active {
            background: #e3f2fd;
            border-color: #007bff;
        }

        .note-title {
            font-weight: 600;
            color: #343a40;
            margin-bottom: 4px;
        }

        .note-preview {
            font-size: 12px;
            color: #6c757d;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .editor-header {
            padding: 20px;
            background: white;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .title-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            font-size: 18px;
            font-weight: 600;
        }

        .editor-container {
            flex: 1;
            display: flex;
        }

        .editor, .preview {
            flex: 1;
            padding: 20px;
        }

        .editor {
            border-right: 1px solid #e9ecef;
        }

        .editor textarea {
            width: 100%;
            height: 100%;
            border: none;
            outline: none;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.6;
            resize: none;
        }

        .preview {
            background: white;
            overflow-y: auto;
        }

        .preview h1, .preview h2, .preview h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            color: #343a40;
        }

        .preview h1 { font-size: 28px; }
        .preview h2 { font-size: 24px; }
        .preview h3 { font-size: 20px; }

        .preview p {
            margin-bottom: 16px;
            line-height: 1.6;
            color: #495057;
        }

        .preview code {
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .preview pre {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 16px;
        }

        .preview blockquote {
            border-left: 4px solid #007bff;
            padding-left: 16px;
            margin: 16px 0;
            color: #6c757d;
        }

        .auth-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .auth-form {
            background: white;
            padding: 32px;
            border-radius: 8px;
            width: 400px;
            max-width: 90vw;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            margin-bottom: 4px;
            font-weight: 600;
        }

        .form-group input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            font-size: 14px;
        }

        .auth-tabs {
            display: flex;
            margin-bottom: 24px;
            border-bottom: 1px solid #e9ecef;
        }

        .auth-tab {
            padding: 8px 16px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
        }

        .auth-tab.active {
            border-bottom: 2px solid #007bff;
            color: #007bff;
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #6c757d;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div id="authModal" class="auth-modal">
        <div class="auth-form">
            <div class="auth-tabs">
                <button class="auth-tab active" onclick="switchTab('login')">Login</button>
                <button class="auth-tab" onclick="switchTab('register')">Register</button>
            </div>
            <form id="authForm">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                    <span id="authButtonText">Login</span>
                </button>
            </form>
        </div>
    </div>

    <div class="app" id="app" style="display: none;">
        <div class="sidebar">
            <div class="sidebar-header">
                <h1>Mini Notes</h1>
                <div class="sidebar-actions">
                    <button class="btn btn-primary" onclick="createNote()">Add</button>
                    <button class="btn btn-secondary" onclick="renameNote()" id="renameBtn" disabled>Rename</button>
                    <button class="btn btn-danger" onclick="deleteNote()" id="deleteBtn" disabled>Delete</button>
                </div>
                <button class="btn btn-secondary" onclick="logout()" style="width: 100%;">Logout</button>
            </div>
            <div class="notes-list" id="notesList">
                <!-- Notes will be populated here -->
            </div>
        </div>

        <div class="main-content">
            <div id="emptyState" class="empty-state">
                Select a note to start editing
            </div>
            <div id="editorSection" style="display: none; flex: 1; flex-direction: column;">
                <div class="editor-header">
                    <input type="text" class="title-input" id="noteTitle" placeholder="Note title...">
                </div>
                <div class="editor-container">
                    <div class="editor">
                        <textarea id="noteContent" placeholder="Start writing your note..."></textarea>
                    </div>
                    <div class="preview" id="preview">
                        <!-- Markdown preview will appear here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentUser = null;
        let currentNote = null;
        let notes = [];
        let authMode = 'login';

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
        });

        function switchTab(mode) {
            authMode = mode;
            const tabs = document.querySelectorAll('.auth-tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('authButtonText').textContent = mode === 'login' ? 'Login' : 'Register';
        }

        async function handleAuth(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

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
                    showApp();
                    loadNotes();
                } else {
                    alert(data.error || 'Authentication failed');
                }
            } catch (error) {
                alert('Network error: ' + error.message);
            }
        }

        function showAuth() {
            document.getElementById('authModal').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
        }

        function showApp() {
            document.getElementById('authModal').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
        }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            currentUser = null;
            currentNote = null;
            notes = [];
            showAuth();
        }

        async function loadNotes() {
            try {
                const response = await fetch('/api/notes', {
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });

                if (response.ok) {
                    notes = await response.json();
                    renderNotesList();
                } else {
                    console.error('Failed to load notes');
                }
            } catch (error) {
                console.error('Error loading notes:', error);
            }
        }

        function renderNotesList() {
            const notesList = document.getElementById('notesList');
            notesList.innerHTML = '';

            notes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note-item';
                if (currentNote && currentNote.id === note.id) {
                    noteElement.classList.add('active');
                }
                
                noteElement.innerHTML = \`
                    <div class="note-title">\${note.title}</div>
                    <div class="note-preview">\${note.content.substring(0, 50)}...</div>
                \`;
                
                noteElement.onclick = () => selectNote(note);
                notesList.appendChild(noteElement);
            });
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
        }

        async function createNote() {
            try {
                const response = await fetch('/api/notes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify({ title: 'New Note', content: '' })
                });

                if (response.ok) {
                    const newNote = await response.json();
                    notes.push(newNote);
                    selectNote(newNote);
                } else {
                    alert('Failed to create note');
                }
            } catch (error) {
                alert('Error creating note: ' + error.message);
            }
        }

        async function saveNote() {
            if (!currentNote) return;

            const title = document.getElementById('noteTitle').value;
            const content = document.getElementById('noteContent').value;

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
                        renderNotesList();
                    }
                }
            } catch (error) {
                console.error('Error saving note:', error);
            }
        }

        async function deleteNote() {
            if (!currentNote) return;
            
            if (!confirm('Are you sure you want to delete this note?')) return;

            try {
                const response = await fetch(\`/api/notes/\${currentNote.id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });

                if (response.ok) {
                    notes = notes.filter(n => n.id !== currentNote.id);
                    currentNote = null;
                    
                    document.getElementById('emptyState').style.display = 'flex';
                    document.getElementById('editorSection').style.display = 'none';
                    document.getElementById('renameBtn').disabled = true;
                    document.getElementById('deleteBtn').disabled = true;
                    
                    renderNotesList();
                } else {
                    alert('Failed to delete note');
                }
            } catch (error) {
                alert('Error deleting note: ' + error.message);
            }
        }

        function renameNote() {
            if (!currentNote) return;
            
            const newTitle = prompt('Enter new title:', currentNote.title);
            if (newTitle && newTitle !== currentNote.title) {
                document.getElementById('noteTitle').value = newTitle;
                saveNote();
            }
        }

        function updatePreview() {
            const content = document.getElementById('noteContent').value;
            const preview = document.getElementById('preview');
            preview.innerHTML = markdownToHtml(content);
        }

        function markdownToHtml(markdown) {
            return markdown
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*)\*/gim, '<em>$1</em>')
                .replace(/\`(.*)\`/gim, '<code>$1</code>')
                .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
                .replace(/\\n/gim, '<br>');
        }

        // Auto-save functionality
        let saveTimeout;
        function autoSave() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveNote, 1000);
        }

        // Event listeners
        document.getElementById('authForm').addEventListener('submit', handleAuth);
        document.getElementById('noteTitle').addEventListener('input', autoSave);
        document.getElementById('noteContent').addEventListener('input', function() {
            updatePreview();
            autoSave();
        });
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