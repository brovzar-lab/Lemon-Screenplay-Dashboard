/**
 * Category Selector
 * Displays category buttons and inline form to create new categories
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UploadPresentation } from '@/components/settings/upload/upload.types';

interface CategorySelectorProps {
  categoryIds: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onAddCategory: (cat: { id: string; name: string; description: string }) => void;
  presentation?: UploadPresentation;
  allowCustomCategories?: boolean;
}

export function CategorySelector({
  categoryIds,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  presentation = 'settings',
  allowCustomCategories = true,
}: CategorySelectorProps) {
  const { t } = useTranslation();
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatError, setNewCatError] = useState('');
  const isIntake = presentation === 'intake';

  return (
    <div>
      <p className={clsx('mb-2 block text-sm font-medium', isIntake ? 'text-[var(--dsc-ink)]' : 'text-gold-300')}>
        {t('Assign Category')}
      </p>
      <div className="flex flex-wrap gap-2">
        {categoryIds.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              isIntake
                ? selectedCategory === cat
                  ? 'border border-[var(--dsc-accent)] bg-[var(--dsc-accent)] text-[var(--dsc-on-accent)]'
                  : 'border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] text-[var(--dsc-ink-2)] hover:border-[var(--dsc-accent)]'
                : selectedCategory === cat
                ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
                : 'bg-black-800/50 text-black-300 border border-black-700 hover:border-gold-500/30'
            )}
          >
            {cat}
          </button>
        ))}

        {/* New + Button */}
        {allowCustomCategories && <button
          onClick={() => setShowNewCatForm(!showNewCatForm)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            isIntake
              ? showNewCatForm
                ? 'border border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)] text-[var(--dsc-accent)]'
                : 'border border-dashed border-[var(--dsc-line)] text-[var(--dsc-ink-3)] hover:border-[var(--dsc-accent)]'
              : showNewCatForm
              ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
              : 'bg-black-800/50 text-black-400 border border-dashed border-black-600 hover:border-gold-500/30 hover:text-gold-300'
          )}
        >
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('New')}
          </span>
        </button>}
      </div>

      {/* Inline New Category Form */}
      {showNewCatForm && (
        <div className={clsx(
          'mt-3 space-y-3 rounded-lg border p-3',
          isIntake ? 'border-[var(--dsc-line)] bg-[var(--dsc-surface-2)]' : 'border-black-700 bg-black-800/50',
        )}>
          <div>
            <label className="block text-xs text-black-400 mb-1">{t('Category Name')}</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={t('e.g. Independent Films')}
              className="input w-full text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).form?.querySelector<HTMLButtonElement>('.btn-primary')?.click();
                }
              }}
            />
          </div>
          {newCatError && <p className="text-xs text-red-400">{newCatError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewCatError('');
                const name = newCatName.trim();
                if (!name) { setNewCatError(t('Enter a category name')); return; }
                // Auto-generate ID from name: uppercase, no spaces, max 10 chars
                const id = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                if (id.length < 2) { setNewCatError(t('Name too short')); return; }
                if (categoryIds.includes(id)) { setNewCatError(t('“{{id}}” already exists', { id })); return; }
                onAddCategory({ id, name, description: t('Created during upload') });
                onSelectCategory(id);
                setNewCatName('');
                setShowNewCatForm(false);
              }}
              className="btn btn-primary text-xs"
            >
              {t('Create & Select')}
            </button>
            <button
              onClick={() => { setShowNewCatForm(false); setNewCatName(''); setNewCatError(''); }}
              className="btn text-xs text-black-400 hover:text-white"
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
