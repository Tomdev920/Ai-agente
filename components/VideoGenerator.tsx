import React, { useState } from 'react';
import { generateVeoVideo } from '../services/gemini';
import { Icons } from './Icon';
import { GlassyLoader } from './GlassyLoader';

export const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [needsKey, setNeedsKey] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    setNeedsKey(false);

    try {
      const result = await generateVeoVideo(prompt, aspectRatio);
      if (result) {
        setVideoUrl(result);
      } else {
        setError('فشل توليد الفيديو. حاول مرة أخرى.');
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || err.toString();
      
      // Check for 404/NotFound which indicates API Key issue with Veo
      if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
          if ((window as any).aistudio) {
             setNeedsKey(true);
             setError('يتطلب نموذج Veo مفتاح API مدفوع (Billing Enabled Project).');
             return;
          }
      }
      setError('خطأ في الاتصال بمحرك Veo. تأكد من صلاحيات المفتاح.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        setNeedsKey(false);
        setError(null);
        // User can click generate again
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4 sm:p-8">
      <div className="mb-8 text-center animate-fadeIn">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-2 tracking-wide neon-text">
           استوديو Veo السينمائي
        </h2>
        <p className="text-slate-400 text-sm font-light">توليد فيديو عالي الدقة (1080p) باستخدام نموذج Veo 3.1</p>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl min-h-[500px]">
         {/* Controls Panel */}
         <div className="p-8 flex-1 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-white/5 bg-black/20 order-2 lg:order-1">
            
            <div className="flex-1">
               <label className="block text-xs font-bold text-emerald-400 mb-3 uppercase tracking-wider">السيناريو (Prompt)</label>
               <textarea 
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 className="w-full h-40 p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-1 focus:ring-emerald-500/50 resize-none text-white placeholder-slate-600 transition-all font-light text-right"
                 placeholder="مثلاً: لقطة سينمائية لسيارة رياضية تسرع في مدينة مستقبلية ليلاً، أضواء النيون..."
                 dir="auto"
               />

               <div className="mt-6">
                   <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">الأبعاد (Aspect Ratio)</label>
                   <div className="flex gap-4">
                       <button 
                         onClick={() => setAspectRatio('16:9')}
                         className={`flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${aspectRatio === '16:9' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-transparent text-slate-500'}`}
                       >
                           <div className="w-8 h-5 border-2 border-current rounded-sm"></div>
                           <span className="text-[10px] font-bold">16:9 (Landscape)</span>
                       </button>
                       <button 
                         onClick={() => setAspectRatio('9:16')}
                         className={`flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${aspectRatio === '9:16' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-transparent text-slate-500'}`}
                       >
                           <div className="w-5 h-8 border-2 border-current rounded-sm"></div>
                           <span className="text-[10px] font-bold">9:16 (Portrait)</span>
                       </button>
                   </div>
               </div>
            </div>
            
            {error && (
              <div className="flex flex-col gap-2 animate-fadeIn">
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                    <Icons.Close size={16} />
                    <span>{error}</span>
                  </div>
                  {needsKey && (
                      <button 
                        onClick={handleSelectKey}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 flex items-center justify-center gap-2 transition-all font-bold text-sm"
                      >
                          <Icons.Link size={16} />
                          ربط حساب مدفوع (Google Cloud)
                      </button>
                  )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className={`w-full py-4 rounded-xl font-bold tracking-wider flex items-center justify-center gap-3 transition-all
                ${!prompt.trim() || isLoading 
                  ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]'}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                   <span className="text-xs">جاري الإخراج (قد يستغرق دقيقة)...</span>
                </div>
              ) : (
                <>
                  <Icons.Video size={18} />
                  <span>توليد الفيديو</span>
                </>
              )}
            </button>
         </div>

         {/* Preview Panel */}
         <div className="p-8 flex-1 flex items-center justify-center bg-black/40 relative order-1 lg:order-2">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#ffffff10 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            {isLoading ? (
                <GlassyLoader text="Veo يقوم بإنشاء المشاهد..." size="lg" showSteps={true} />
            ) : videoUrl ? (
              <div className="relative group w-full max-w-md mx-auto animate-fadeIn z-10 flex flex-col items-center gap-4">
                 <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/30">
                     <video 
                       src={videoUrl} 
                       controls 
                       autoPlay 
                       loop 
                       className="w-full h-auto"
                     />
                 </div>
                 <a 
                   href={videoUrl} 
                   download="veo_generated.mp4"
                   target="_blank"
                   rel="noreferrer"
                   className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-all border border-white/10"
                 >
                     <Icons.Download size={16} /> تحميل MP4
                 </a>
              </div>
            ) : (
              <div className="text-center text-slate-600 z-10">
                  <div className="w-24 h-24 rounded-full border border-dashed border-slate-700 flex items-center justify-center mx-auto mb-4 bg-black/20">
                     <Icons.Video size={32} className="opacity-50" />
                  </div>
                  <p className="text-xs font-mono tracking-widest uppercase">شاشة العرض</p>
                  <p className="text-[10px] text-slate-700 mt-2">Veo 3.1 Model</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};