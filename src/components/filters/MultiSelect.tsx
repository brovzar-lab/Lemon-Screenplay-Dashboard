/**
 * MultiSelect Component
 * Dropdown with checkboxes for multi-selection
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-sm font-medium text-black-400">{label}</label>

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm',
            'bg-black-900 border transition-all',
            isOpen ? 'border-gold-500 ring-2 ring-gold-500/20' : 'border-black-700 hover:border-black-600',
            selected.length > 0 ? 'text-black-100' : 'text-black-500'
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
          </span>
          <svg
            className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Selected Tags */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selected.slice(0, 3).map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gold-500/20 text-gold-300 text-xs"
              >
                {item}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(item);
                  }}
                  className="hover:text-gold-100"
                >
                  ×
                </button>
              </span>
            ))}
            {selected.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-black-500">
                +{selected.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 py-2 bg-black-800 border border-black-700 rounded-lg shadow-xl max-h-64 overflow-hidden">
            {/* Search */}
            <div className="px-2 pb-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-sm bg-black-900 border border-black-700 rounded focus:outline-none focus:border-gold-500"
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="max-h-40 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-black-500 text-center">No matches</div>
              ) : (
                filteredOptions.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-black-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => toggleOption(option)}
                      className="w-4 h-4 rounded border-black-600 bg-black-900 text-gold-500 focus:ring-gold-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-black-200 truncate">{option}</span>
                  </label>
                ))
              )}
            </div>

            {/* Actions */}
            {selected.length > 0 && (
              <div className="border-t border-black-700 mt-2 pt-2 px-2">
                <button
                  onClick={clearAll}
                  className="w-full text-xs text-red-400 hover:text-red-300 py-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiSelect;
