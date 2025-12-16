import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from '../types';
import { Icons } from './Icon';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;
  // If role is model, content is empty, and no error, it's thinking
  const isThinking = !isUser && !message.content && !message.isError;
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip basic markdown symbols for better reading
    const cleanText = message.content
      .replace(/[*#_`~]/g, '') // Remove formatting chars
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Keep link text, remove URL

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to get an Arabic voice
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.includes('ar'));
    if (arVoice) {
      utterance.voice = arVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    // Cancel any current speech before starting new
    window.speechSynthesis.cancel();
    
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className={`flex w-full gap-4 animate-fadeIn group ${isUser ? 'justify-start' : 'flex-row-reverse justify-start'}`}>
      <div 
        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center glass-button border border-white/10 shadow-lg
          ${isUser 
            ? 'bg-white/5 text-slate-300' 
            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}`}
      >
        {isUser ? <Icons.User size={20} /> : <Icons.Bot size={22} className="drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />}
      </div>

      <div className={`flex flex-col max-w-[85%] sm:max-w-[80%] lg:max-w-[75%] ${isUser ? 'items-start' : 'items-end'}`}>
        <div className={`flex items-center gap-2 mb-2 ${!isUser && 'flex-row-reverse'}`}>
          <span className={`text-xs font-bold tracking-wider uppercase ${isUser ? 'text-slate-400' : 'text-cyan-400'}`}>
            {isUser ? 'User' : 'Toma Ai'}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">
            {new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div 
          className={`relative px-5 py-4 rounded-2xl backdrop-blur-md border transition-all duration-300 w-fit group/bubble
            ${isUser 
              ? 'bg-white/5 border-white/5 text-slate-200 rounded-tr-none hover:bg-white/10' 
              : 'bg-black/40 border-cyan-500/20 text-slate-100 rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-cyan-500/40'}`}
        >
          {message.isError ? (
            <div className="text-red-400 flex items-center gap-2 font-mono text-sm bg-red-500/10 p-2 rounded">
               <span>⚠️</span>
               <span>ERROR: {message.content}</span>
            </div>
          ) : isThinking ? (
             <div className="py-2 px-2 flex items-center gap-3" dir="ltr">
                <div className="relative w-4 h-4">
                  <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
                  <div className="absolute inset-0.5 bg-cyan-500 rounded-full"></div>
                </div>
                <span className="text-xs font-mono text-cyan-300 tracking-widest animate-pulse">ANALYZING...</span>
             </div>
          ) : (
             <>
               <MarkdownRenderer content={message.content} />
               
               {/* Actions Toolbar */}
               <div className={`mt-2 pt-2 border-t border-white/5 flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
                  {/* Copy Button */}
                  <button
                     onClick={handleCopy}
                     className="p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-400 hover:text-cyan-400 hover:bg-white/10"
                     title="نسخ النص"
                  >
                     {isCopied ? (
                        <>
                           <Icons.Check size={12} className="text-green-400" />
                           <span className="text-green-400">تم النسخ</span>
                        </>
                     ) : (
                        <>
                           <Icons.Copy size={12} />
                           <span>نسخ</span>
                        </>
                     )}
                  </button>

                  {/* TTS Button */}
                  <button 
                    onClick={handleSpeak}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider
                      ${isSpeaking 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-white/5 text-slate-400 hover:text-cyan-400 hover:bg-white/10'}`}
                    title={isSpeaking ? "إيقاف القراءة" : "قراءة النص"}
                  >
                    {isSpeaking ? (
                      <>
                        <Icons.Stop size={12} className="animate-pulse" />
                        <span>إيقاف</span>
                      </>
                    ) : (
                      <>
                        <Icons.Volume size={12} />
                        <span>استماع</span>
                      </>
                    )}
                  </button>
               </div>
             </>
          )}
        </div>
      </div>
    </div>
  );
};