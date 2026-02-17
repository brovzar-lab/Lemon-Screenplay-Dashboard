/**
 * NotesSection — user notes for a screenplay.
 * Reactive via Zustand hooks, inline textarea input.
 */

import { useState } from 'react';
import { useNotesStore, useScreenplayNotes } from '@/stores/notesStore';
import { SectionHeader } from './SectionHeader';

interface NotesSectionProps {
    screenplayId: string;
}

export function NotesSection({ screenplayId }: NotesSectionProps) {
    const notes = useScreenplayNotes(screenplayId);
    const addNote = useNotesStore((s) => s.addNote);
    const deleteNote = useNotesStore((s) => s.deleteNote);
    const [draft, setDraft] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    if (!screenplayId) return null;

    const handleSubmit = () => {
        if (draft.trim()) {
            addNote(screenplayId, draft.trim());
            setDraft('');
            setIsAdding(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit();
        }
        if (e.key === 'Escape') {
            setIsAdding(false);
            setDraft('');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <SectionHeader icon="📝">Notes ({notes.length})</SectionHeader>
                {!isAdding && (
                    <button onClick={() => setIsAdding(true)} className="btn btn-secondary text-sm">
                        + Add Note
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="space-y-2">
                    <textarea
                        autoFocus
                        className="input w-full resize-none"
                        rows={3}
                        placeholder="Write your note..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => { setIsAdding(false); setDraft(''); }}
                            className="btn btn-secondary text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!draft.trim()}
                            className="btn btn-primary text-sm"
                        >
                            Save Note
                        </button>
                    </div>
                    <p className="text-xs text-black-600">Cmd/Ctrl+Enter to save, Esc to cancel</p>
                </div>
            )}

            {notes.length === 0 && !isAdding ? (
                <p className="text-sm text-black-500 italic">No notes yet. Add one to track your thoughts.</p>
            ) : (
                <div className="space-y-2">
                    {notes.map((note) => (
                        <div key={note.id} className="p-3 rounded-lg bg-black-900/50 group">
                            <div className="flex justify-between items-start gap-2">
                                <p className="text-sm text-black-300 whitespace-pre-wrap">{note.content}</p>
                                <button
                                    onClick={() => deleteNote(screenplayId, note.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="text-xs text-black-600 mt-1">
                                {new Date(note.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
