import React, { useState } from 'react';
import { generateImage } from '../services/gemini';
import { Icons } from './Icon';
import { GlassyLoader } from './GlassyLoader';

type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('gemini-2.5-flash-image');
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const result = await generateImage(prompt, selectedModel);
      if (result) {
        setImageUrl(result);
      } else {
        setError('فشل التوليد. الاتصال العصبي غير مستقر.');
      }
    } catch (err) {
      setError('خطأ حرج في وحدة التصنيع البصري.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `TOMA_VISION_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 sm:p-8">
      <div className="mb-8 text-center animate-fadeIn">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2 tracking-wide neon-text">
           استوديو الرؤية
        </h2>
        <p className="text-slate-400 text-sm font-light">محرك تخليق بصري مدعوم بالذكاء العصبي</p>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl min-h-[500px]">
         {/* Controls Panel */}
         <div className="p-8 flex-1 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-white/5 bg-black/20 order-2 lg:order-1">
            <div className="flex-1">
               <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">مصفوفة الوصف</label>
                  
                  {/* Model Selector */}
                  <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                     <button 
                       onClick={() => setSelectedModel('gemini-2.5-flash-image')}
                       className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${selectedModel === 'gemini-2.5-flash-image' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                     >
                       <Icons.Cpu size={10} /> قياسي (Flash)
                     </button>
                     <button 
                       onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                       className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${selectedModel === 'gemini-3-pro-image-preview' ? 'bg-pink-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                     >
                       <Icons.Sparkles size={10} /> عالي الدقة (Pro)
                     </button>
                  </div>
               </div>
               
               <textarea 
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 className="w-full h-48 p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none text-white placeholder-slate-600 transition-all font-light text-right"
                 placeholder="صف المعطيات البصرية..."
                 dir="auto"
               />
               <div className="mt-2 flex gap-2 flex-wrap">
                  {['مدينة سايبر بانك', 'لوحة زيتية لقطة', 'شعار بسيط'].map(tag => (
                     <button key={tag} onClick={() => setPrompt(tag)} className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        {tag}
                     </button>
                  ))}
               </div>
            </div>
            
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                <Icons.Close size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className={`w-full py-4 rounded-xl font-bold tracking-wider flex items-center justify-center gap-3 transition-all
                ${!prompt.trim() || isLoading 
                  ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.5)]'}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                   <span className="text-xs">جاري المعالجة ({selectedModel.includes('pro') ? 'HD' : 'STD'})...</span>
                </div>
              ) : (
                <>
                  <Icons.Cpu size={18} />
                  <span>توليد</span>
                </>
              )}
            </button>
         </div>

         {/* Preview Panel */}
         <div className="p-8 flex-1 flex items-center justify-center bg-black/40 relative order-1 lg:order-2">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#ffffff10 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            {isLoading ? (
                <GlassyLoader text="تصيير البكسلات..." />
            ) : imageUrl ? (
              <div className="relative group w-full max-w-md mx-auto animate-fadeIn z-10">
                <div className="absolute -inset-1 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                <img 
                  src={imageUrl} 
                  alt="Generated" 
                  className="relative w-full h-auto rounded-xl shadow-2xl border border-white/10"
                />
                <button 
                  onClick={handleDownload}
                  className="absolute bottom-4 right-4 p-3 bg-black/70 backdrop-blur-xl rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-white/20"
                  title="حفظ الأصل"
                >
                  <Icons.Download size={20} />
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-600 z-10">
                  <div className="w-20 h-20 rounded-full border border-dashed border-slate-700 flex items-center justify-center mx-auto mb-4">
                     <Icons.Image size={32} className="opacity-50" />
                  </div>
                  <p className="text-xs font-mono tracking-widest uppercase">شاشة المخرجات</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};