import React, { useState, useRef, useEffect } from 'react';
import { ModelConfig, AVAILABLE_MODELS, ModelType } from '../types';
import { Icons } from './Icon';

interface ModelSelectorProps {
  currentModel: ModelType;
  onSelect: (model: ModelType) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selected = AVAILABLE_MODELS.find(m => m.id === currentModel) || AVAILABLE_MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Icons.Cpu size={14} className="text-cyan-400" />
        <span className="hidden sm:inline uppercase tracking-wider">{selected.name}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-72 p-2 glass-panel rounded-2xl z-50 overflow-hidden rtl:left-0 ltr:right-0 sm:rtl:right-0 sm:ltr:left-auto backdrop-blur-2xl">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                setIsOpen(false);
              }}
              className={`w-full text-left flex flex-col gap-1 px-4 py-3 rounded-xl transition-all ${
                currentModel === model.id
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                  : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                 <span className="font-bold text-xs uppercase tracking-wide">{model.name}</span>
                 {currentModel === model.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>}
              </div>
              <span className="text-[10px] opacity-60 font-mono truncate w-full">{model.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};