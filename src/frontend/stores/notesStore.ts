import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesState {
  notes: Note[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;
}

export interface NotesActions {
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: Note | null) => void;
  clearError: () => void;
}

export type NotesStore = NotesState & NotesActions;

export const useNotesStore = create<NotesStore>((set, get) => ({
  // State
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,

  // Actions
  fetchNotes: async () => {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/notes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notes');
      }

      set({ notes: data.notes, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
      });
    }
  },

  createNote: async (title: string, content: string) => {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create note');
      }

      const { notes } = get();
      set({ 
        notes: [data.note, ...notes], 
        currentNote: data.note,
        isLoading: false 
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      });
    }
  },

  updateNote: async (id: string, updates: Partial<Note>) => {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update note');
      }

      const { notes, currentNote } = get();
      const updatedNotes = notes.map(note => 
        note.id === id ? data.note : note
      );
      
      set({ 
        notes: updatedNotes,
        currentNote: currentNote?.id === id ? data.note : currentNote,
        isLoading: false 
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update note',
      });
    }
  },

  deleteNote: async (id: string) => {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete note');
      }

      const { notes, currentNote } = get();
      const filteredNotes = notes.filter(note => note.id !== id);
      
      set({ 
        notes: filteredNotes,
        currentNote: currentNote?.id === id ? null : currentNote,
        isLoading: false 
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete note',
      });
    }
  },

  setCurrentNote: (note: Note | null) => {
    set({ currentNote: note });
  },

  clearError: () => {
    set({ error: null });
  },
}));