# Mini Notes

A clean, modern markdown notes app built with Cloudflare Workers and KV storage.

## Features

- 🔐 User authentication with secure password hashing
- 📝 Markdown editor with live preview
- 💾 Cloud storage using Cloudflare KV
- 🎨 Clean, responsive UI with sidebar navigation
- ⚡ Fast performance with Cloudflare Workers
- 🔄 Auto-save functionality
- 📱 Mobile-friendly design

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespaces

You need to create two KV namespaces in your Cloudflare dashboard:

```bash
# Create KV namespaces
wrangler kv:namespace create "NOTES"
wrangler kv:namespace create "USERS"

# Create preview namespaces for development
wrangler kv:namespace create "NOTES" --preview
wrangler kv:namespace create "USERS" --preview
```

### 3. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml` with your actual KV namespace IDs from the previous step.

### 4. Development

```bash
# Start local development server
npm run dev
```

### 5. Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Usage

1. **Register/Login**: Create an account or log in with existing credentials
2. **Create Notes**: Click the "Add" button to create a new note
3. **Edit Notes**: Click on any note in the sidebar to start editing
4. **Markdown Support**: Use markdown syntax for formatting
5. **Auto-save**: Changes are automatically saved as you type
6. **Rename**: Use the "Rename" button to change note titles
7. **Delete**: Use the "Delete" button to remove notes

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript with markdown editor
- **Backend**: Cloudflare Workers for serverless API
- **Storage**: Cloudflare KV for user data and notes
- **Authentication**: bcrypt for password hashing

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/notes` - Get all user notes
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

## Security Features

- Password hashing with bcrypt
- Token-based authentication
- CORS protection
- Input validation
- Secure KV storage separation by user