/**
 * RangeSlider Component
 * Dual-handle slider for score range filtering
 */

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  formatValue?: (value: number) => string;
}

export function RangeSlider({
  label,
  min,
  max,
  step = 0.5,
  value,
  onChange,
  enabled,
  onEnabledChange,
  formatValue = (v) => v.toFixed(1),
}: RangeSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseFloat(e.target.value);
    const newValue: [number, number] = [Math.min(newMin, localValue[1] - step), localValue[1]];
    setLocalValue(newValue);
    onChange(newValue);
  }, [localValue, onChange, step]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseFloat(e.target.value);
    const newValue: [number, number] = [localValue[0], Math.max(newMax, localValue[0] + step)];
    setLocalValue(newValue);
    onChange(newValue);
  }, [localValue, onChange, step]);

  const percentage = (val: number) => ((val - min) / (max - min)) * 100;

  return (
    <div className={clsx('space-y-2 p-3 rounded-lg transition-all', enabled ? 'bg-gold-500/5' : 'bg-black-900/30')}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-black-600 bg-black-800 text-gold-500 focus:ring-gold-500 focus:ring-offset-0"
          />
          <span className={clsx('text-sm font-medium', enabled ? 'text-gold-300' : 'text-black-400')}>
            {label}
          </span>
        </label>
        <span className={clsx('text-xs font-mono', enabled ? 'text-gold-400' : 'text-black-500')}>
          {formatValue(localValue[0])} - {formatValue(localValue[1])}
        </span>
      </div>

      {enabled && (
        <div className="relative pt-2">
          {/* Track background */}
          <div className="absolute h-2 w-full bg-black-700 rounded-full" />

          {/* Active track */}
          <div
            className="absolute h-2 bg-gradient-to-r from-gold-600 to-gold-400 rounded-full"
            style={{
              left: `${percentage(localValue[0])}%`,
              width: `${percentage(localValue[1]) - percentage(localValue[0])}%`,
            }}
          />

          {/* Min slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue[0]}
            onChange={handleMinChange}
            className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:pointer-events-auto
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-gold-400
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-gold-600
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:hover:bg-gold-300"
          />

          {/* Max slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue[1]}
            onChange={handleMaxChange}
            className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:pointer-events-auto
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-gold-400
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-gold-600
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:hover:bg-gold-300"
          />
        </div>
      )}
    </div>
  );
}

export default RangeSlider;
