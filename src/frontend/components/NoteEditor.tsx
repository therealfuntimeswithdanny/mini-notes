import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Note } from '../stores/notesStore';
import './NoteEditor.css';

interface NoteEditorProps {
  note?: Note;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  isNew: boolean;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onSave,
  onCancel,
  isNew
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setHasChanges(false);
    }
  }, [note]);

  useEffect(() => {
    const hasUnsavedChanges = 
      title !== (note?.title || '') || 
      content !== (note?.content || '');
    setHasChanges(hasUnsavedChanges);
  }, [title, content, note]);

  const handleSave = () => {
    if (title.trim() && content.trim()) {
      onSave(title.trim(), content.trim());
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const isSaveDisabled = !title.trim() || !content.trim() || !hasChanges;

  return (
    <div className="note-editor">
      <div className="editor-header">
        <div className="editor-controls">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`preview-toggle ${showPreview ? 'active' : ''}`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
        
        <div className="editor-actions">
          <button onClick={handleCancel} className="cancel-button">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="save-button"
            disabled={isSaveDisabled}
          >
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-content">
        {!showPreview ? (
          <>
            <input
              type="text"
              className="title-input"
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="content-input"
              placeholder="Start writing your note... (Markdown supported)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
            />
          </>
        ) : (
          <div className="preview-content">
            <h1 className="preview-title">{title || 'Untitled Note'}</h1>
            <div className="markdown-preview">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="empty-content">No content to preview</p>
              )}
            </div>
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="unsaved-indicator">
          <span>You have unsaved changes</span>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;