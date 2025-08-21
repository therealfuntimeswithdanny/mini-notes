import React from 'react';
import { Note } from '../stores/notesStore';
import './NotesSidebar.css';

interface NotesSidebarProps {
  notes: Note[];
  currentNote: Note | null;
  onNoteSelect: (note: Note) => void;
  onNewNote: () => void;
  isCreating: boolean;
}

const NotesSidebar: React.FC<NotesSidebarProps> = ({
  notes,
  currentNote,
  onNoteSelect,
  onNewNote,
  isCreating
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength ? `${title.slice(0, maxLength)}...` : title;
  };

  return (
    <div className="notes-sidebar">
      <div className="sidebar-header">
        <h2>Notes</h2>
        <button 
          onClick={onNewNote}
          className="new-note-button"
          disabled={isCreating}
        >
          + New Note
        </button>
      </div>

      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="empty-notes">
            <p>No notes yet</p>
            <p>Create your first note to get started!</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${currentNote?.id === note.id ? 'active' : ''}`}
              onClick={() => onNoteSelect(note)}
            >
              <div className="note-title">
                {truncateTitle(note.title)}
              </div>
              <div className="note-meta">
                <span className="note-date">
                  {formatDate(note.updatedAt)}
                </span>
                {note.updatedAt !== note.createdAt && (
                  <span className="note-modified">Modified</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesSidebar;