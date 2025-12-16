import React, { useEffect, useState } from 'react';
import { Icons } from './Icon';

interface GlassyLoaderProps {
  text?: string;
  size?: 'sm' | 'lg';
  progress?: number; 
  showSteps?: boolean;
}

export const GlassyLoader: React.FC<GlassyLoaderProps> = ({ 
  text = "PROCESSING...", 
  size = 'lg',
  progress,
  showSteps = false
}) => {
  const isLarge = size === 'lg';
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    "ANALYZING INPUT VECTOR...",
    "CONSTRUCTING WIREFRAME...",
    "OPTIMIZING UX PATTERNS...",
    "GENERATING DOM STRUCTURE...",
    "APPLYING STYLE MATRIX...",
    "INJECTING LOGIC CIRCUITS...",
    "FINALIZING RENDER..."
  ];

  useEffect(() => {
    if (showSteps) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length);
      }, 2000); 
      return () => clearInterval(interval);
    }
  }, [showSteps]);

  const displayText = showSteps ? steps[currentStep] : text;

  return (
    <div className="flex flex-col items-center justify-center p-8 animate-fadeIn w-full max-w-md mx-auto">
      <div className={`relative flex items-center justify-center ${isLarge ? 'w-40 h-40' : 'w-20 h-20'} mb-8`}>
         {/* Outer Rotating Rings */}
         <div className="absolute inset-0 rounded-full border border-cyan-500/30 border-t-cyan-400 border-r-transparent animate-spin-slow"></div>
         <div className="absolute inset-2 rounded-full border border-purple-500/20 border-b-purple-400 border-l-transparent animate-[spin_5s_linear_infinite_reverse]"></div>
         
         {/* Core Glow */}
         <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl animate-pulse"></div>

         {/* Central Hexagon/Core */}
         <div className={`relative ${isLarge ? 'w-24 h-24' : 'w-12 h-12'} glass-panel rounded-full flex items-center justify-center overflow-hidden z-10 border border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.2)]`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-blue-600/20"></div>
            <Icons.Cpu className={`text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] ${isLarge ? 'w-10 h-10' : 'w-5 h-5'} animate-pulse`} />
         </div>
      </div>
      
      {/* Text Terminal */}
      <div className="flex flex-col items-center gap-3 w-full">
         <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-black/40 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
            <p className="text-xs font-mono tracking-widest text-cyan-400">
               {displayText}
            </p>
         </div>

         {progress !== undefined && (
            <div className="w-full max-w-xs mt-4">
               <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                  <span>SYSTEM_LOAD</span>
                  <span>{Math.round(progress)}%</span>
               </div>
               <div className="w-full bg-white/5 rounded-none h-1.5 overflow-hidden">
                  <div 
                     className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full shadow-[0_0_10px_#06b6d4] transition-all duration-200" 
                     style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
               </div>
            </div>
         )}
      </div>
    </div>
  );
};