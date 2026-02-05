/**
 * Favorites Panel
 * Manage favorite lists and quick favorites
 */

import { useState } from 'react';
import { useFavoritesStore, type FavoriteList } from '@/stores/favoritesStore';

export function FavoritesPanel() {
  const { lists, quickFavorites, createList, deleteList, renameList } = useFavoritesStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateList = () => {
    if (newListName.trim()) {
      createList(newListName.trim());
      setNewListName('');
      setIsCreating(false);
    }
  };

  const handleStartEdit = (list: FavoriteList) => {
    setEditingId(list.id);
    setEditName(list.name);
  };

  const handleSaveEdit = (listId: string) => {
    if (editName.trim()) {
      renameList(listId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Favorites</h2>
        <p className="text-sm text-black-400">
          Organize your favorite screenplays into custom lists for easy access.
        </p>
      </div>

      {/* Quick Favorites */}
      <div className="p-4 rounded-xl bg-black-800/50 border border-black-700">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <h3 className="text-lg font-medium text-gold-200">Quick Favorites</h3>
        </div>
        <p className="text-sm text-black-400 mb-2">
          {quickFavorites.length} screenplays saved as quick favorites
        </p>
        <p className="text-xs text-black-500">
          Click the star icon on any screenplay card to add it here.
        </p>
      </div>

      {/* Custom Lists */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gold-200">Custom Lists</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-secondary text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New List
          </button>
        </div>

        {/* Create New List Form */}
        {isCreating && (
          <div className="mb-4 p-4 rounded-lg bg-black-800/50 border border-gold-500/30">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name..."
              className="input w-full mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateList();
                if (e.key === 'Escape') setIsCreating(false);
              }}
            />
            <div className="flex gap-2">
              <button onClick={handleCreateList} className="btn btn-primary text-sm">
                Create
              </button>
              <button onClick={() => setIsCreating(false)} className="btn btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List of Custom Lists */}
        {lists.length === 0 ? (
          <div className="text-center py-8 text-black-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No custom lists yet</p>
            <p className="text-sm mt-1">Create a list to organize your favorite screenplays</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors"
              >
                {/* List Icon */}
                <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>

                {/* List Info */}
                <div className="flex-1 min-w-0">
                  {editingId === list.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input w-full text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(list.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => handleSaveEdit(list.id)}
                    />
                  ) : (
                    <>
                      <p className="font-medium text-gold-200 truncate">{list.name}</p>
                      <p className="text-xs text-black-500">
                        {list.screenplayIds.length} screenplays · Updated {new Date(list.updatedAt).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== list.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartEdit(list)}
                      className="p-2 text-black-400 hover:text-gold-400 transition-colors"
                      title="Rename list"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteList(list.id)}
                      className="p-2 text-black-400 hover:text-red-400 transition-colors"
                      title="Delete list"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="p-4 rounded-lg bg-black-800/30 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-2">How to use lists</h4>
        <ul className="text-sm text-black-400 space-y-1">
          <li>• Click the bookmark icon on any screenplay to add it to a list</li>
          <li>• Use the filter panel to show only screenplays from a specific list</li>
          <li>• Export lists as CSV or JSON for external use</li>
        </ul>
      </div>
    </div>
  );
}

export default FavoritesPanel;
