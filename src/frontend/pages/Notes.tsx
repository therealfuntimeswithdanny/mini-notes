import React, { useState, useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import NoteEditor from '../components/NoteEditor';
import NotesSidebar from '../components/NotesSidebar';
import './Notes.css';

const Notes: React.FC = () => {
  const { notes, currentNote, fetchNotes, createNote, setCurrentNote } = useNotesStore();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async (title: string, content: string) => {
    await createNote(title, content);
    setIsCreating(false);
  };

  const handleNoteSelect = (note: any) => {
    setCurrentNote(note);
    setIsCreating(false);
  };

  const handleNewNote = () => {
    setIsCreating(true);
    setCurrentNote(null);
  };

  return (
    <div className="notes-container">
      <NotesSidebar
        notes={notes}
        currentNote={currentNote}
        onNoteSelect={handleNoteSelect}
        onNewNote={handleNewNote}
        isCreating={isCreating}
      />
      
      <div className="notes-content">
        {isCreating ? (
          <NoteEditor
            onSave={handleCreateNote}
            onCancel={() => setIsCreating(false)}
            isNew={true}
          />
        ) : currentNote ? (
          <NoteEditor
            note={currentNote}
            onSave={(title, content) => {
              // Handle update through store
            }}
            onCancel={() => setCurrentNote(null)}
            isNew={false}
          />
        ) : (
          <div className="empty-state">
            <h2>Welcome to Mini Notes</h2>
            <p>Select a note from the sidebar or create a new one to get started.</p>
            <button onClick={handleNewNote} className="primary-button">
              Create New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;