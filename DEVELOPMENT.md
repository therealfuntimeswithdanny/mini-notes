# Development Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Servers

**Terminal 1 - Cloudflare Worker:**
```bash
npm run dev
```
This starts the backend API at `http://localhost:8787`

**Terminal 2 - React Frontend:**
```bash
npm run dev:frontend
```
This starts the frontend dev server at `http://localhost:3000`

### 3. Access the Application
- Frontend: http://localhost:3000
- API: http://localhost:8787
- The frontend is configured to proxy API calls to the worker

## 🏗️ Architecture Overview

### Backend (Cloudflare Workers)
- **Entry Point**: `src/worker/index.ts`
- **Router**: `src/worker/router.ts` - Custom HTTP router with parameter support
- **Controllers**: 
  - `src/worker/controllers/auth.ts` - Authentication logic
  - `src/worker/controllers/notes.ts` - Notes CRUD operations
  - `src/worker/controllers/static.ts` - Static file serving

### Frontend (React)
- **Entry Point**: `src/frontend/main.tsx`
- **App**: `src/frontend/App.tsx` - Main routing and layout
- **Pages**: 
  - `src/frontend/pages/Login.tsx` - User authentication
  - `src/frontend/pages/Register.tsx` - User registration
  - `src/frontend/pages/Notes.tsx` - Main notes interface
- **Components**:
  - `src/frontend/components/Layout.tsx` - Header and navigation
  - `src/frontend/components/NotesSidebar.tsx` - Notes list sidebar
  - `src/frontend/components/NoteEditor.tsx` - Markdown editor with preview
- **State Management**: 
  - `src/frontend/stores/authStore.ts` - Authentication state
  - `src/frontend/stores/notesStore.ts` - Notes state and operations

## 🔧 Development Workflow

### Making Changes

1. **Backend Changes**: Edit files in `src/worker/`
   - The worker automatically reloads on file changes
   - Check the terminal for any compilation errors

2. **Frontend Changes**: Edit files in `src/frontend/`
   - Vite provides hot module replacement
   - Changes are reflected immediately in the browser

3. **Styling**: Edit CSS files alongside their components
   - CSS variables are defined in `src/frontend/index.css`
   - Component-specific styles are in separate `.css` files

### Testing Changes

1. **API Testing**: Use the worker dev server at `localhost:8787`
2. **Frontend Testing**: Use the Vite dev server at `localhost:3000`
3. **Integration Testing**: Both servers work together with API proxying

## 📁 File Structure

```
src/
├── worker/                 # Backend (Cloudflare Workers)
│   ├── index.ts          # Main entry point
│   ├── router.ts         # HTTP router
│   └── controllers/      # API controllers
│       ├── auth.ts       # Authentication
│       ├── notes.ts      # Notes CRUD
│       └── static.ts     # Static files
├── frontend/              # Frontend (React)
│   ├── components/       # Reusable components
│   ├── pages/           # Page components
│   ├── stores/          # State management
│   ├── App.tsx          # Main app
│   ├── main.tsx         # React entry
│   └── index.html       # HTML template
└── shared/               # Shared types (future)
```

## 🛠️ Available Scripts

- `npm run dev` - Start Cloudflare Worker dev server
- `npm run dev:frontend` - Start React dev server
- `npm run build:frontend` - Build frontend for production
- `npm run build:worker` - Test worker build (dry run)
- `npm run build` - Build both frontend and worker
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🔍 Debugging

### Backend Debugging
- Check the worker terminal for logs
- Use `console.log()` in worker code
- Check browser Network tab for API calls

### Frontend Debugging
- Use browser DevTools
- React DevTools extension for component debugging
- Check browser console for errors

### Common Issues

1. **CORS Errors**: Ensure the worker is running and CORS headers are set
2. **Build Errors**: Check TypeScript compilation and import paths
3. **API Errors**: Verify KV namespaces are configured correctly

## 🚀 Deployment

### 1. Build the Frontend
```bash
npm run build:frontend
```

### 2. Deploy to Cloudflare
```bash
npm run deploy
```

### 3. Verify Deployment
- Check Cloudflare dashboard
- Test the live application
- Monitor logs with `npm run tail`

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)