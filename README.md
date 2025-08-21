# Mini Notes v2.0

A modern, full-stack markdown notes application built with **Cloudflare Workers**, **React 18**, **TypeScript**, and **Zustand** for state management.

## ✨ Features

- 🔐 **Secure Authentication** - User registration and login with bcrypt password hashing
- 📝 **Rich Markdown Editor** - Live preview with syntax highlighting
- 💾 **Cloud Storage** - Cloudflare KV for reliable, fast data storage
- 🎨 **Modern UI/UX** - Clean, responsive design with CSS variables and smooth transitions
- ⚡ **Fast Performance** - Built on Cloudflare's edge network
- 📱 **Mobile-First** - Responsive design that works on all devices
- 🔄 **Real-time Updates** - Instant sync between editor and preview
- 🗂️ **Smart Organization** - Automatic note sorting and metadata tracking

## 🏗️ Architecture

### Backend (Cloudflare Workers)
- **TypeScript** for type safety and better development experience
- **Modular Architecture** with separate controllers for auth and notes
- **Custom Router** for clean API endpoint management
- **KV Storage** with user-specific data isolation
- **CORS Support** for cross-origin requests

### Frontend (React)
- **React 18** with modern hooks and functional components
- **TypeScript** for type safety and IntelliSense
- **React Router v6** for client-side routing
- **Zustand** for lightweight, fast state management
- **CSS Modules** with CSS variables for consistent theming
- **Responsive Design** with mobile-first approach

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Cloudflare account with Workers and KV enabled

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Cloudflare KV Namespaces
```bash
# Create production namespaces
wrangler kv:namespace create "NOTES"
wrangler kv:namespace create "USERS"

# Create preview namespaces for development
wrangler kv:namespace create "NOTES" --preview
wrangler kv:namespace create "USERS" --preview
```

### 3. Update Configuration
Replace the placeholder IDs in `wrangler.toml` with your actual KV namespace IDs.

### 4. Development
```bash
# Start the Cloudflare Worker locally
npm run dev

# In another terminal, start the React dev server
npm run build:frontend
npm run preview
```

### 5. Build & Deploy
```bash
# Build the frontend
npm run build:frontend

# Deploy to Cloudflare Workers
npm run deploy
```

## 📁 Project Structure

```
src/
├── worker/                 # Cloudflare Worker backend
│   ├── index.ts          # Main worker entry point
│   ├── router.ts         # Custom HTTP router
│   └── controllers/      # API controllers
│       ├── auth.ts       # Authentication logic
│       ├── notes.ts      # Notes CRUD operations
│       └── static.ts     # Static file serving
├── frontend/              # React frontend
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   ├── stores/          # Zustand state stores
│   ├── App.tsx          # Main app component
│   └── main.tsx         # React entry point
└── shared/               # Shared types and utilities
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Notes
- `GET /api/notes` - Get all user notes
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

## 🎨 UI Components

- **Layout** - Header with user info and logout
- **NotesSidebar** - Navigation and note list
- **NoteEditor** - Markdown editor with live preview
- **Auth Forms** - Login and registration forms

## 🛠️ Development Tools

- **ESLint** - Code quality and consistency
- **TypeScript** - Type safety and better DX
- **Vite** - Fast build tool and dev server
- **CSS Variables** - Consistent theming system

## 🔒 Security Features

- Password hashing with bcrypt
- Token-based authentication
- User data isolation in KV storage
- CORS protection
- Input validation and sanitization

## 📱 Responsive Design

The application is built with a mobile-first approach and includes:
- Responsive breakpoints for all screen sizes
- Touch-friendly interface elements
- Optimized layouts for mobile devices
- Progressive enhancement

## 🚀 Performance Optimizations

- Cloudflare edge computing
- Efficient KV storage queries
- Optimized React rendering
- CSS-in-JS with minimal overhead
- Lazy loading and code splitting ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔮 Future Enhancements

- [ ] Real-time collaboration
- [ ] Advanced markdown features
- [ ] Note sharing and permissions
- [ ] Offline support with service workers
- [ ] Dark mode theme
- [ ] Note categories and tags
- [ ] Search functionality
- [ ] Export/import features