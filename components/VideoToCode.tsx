import React, { useState, useRef } from 'react';
import { analyzeUiMedia, generateCodeFromPlan, ReverseEngineeringPlan, cleanCodeResponse } from '../services/gemini';
import { Icons } from './Icon';
import { GlassyLoader } from './GlassyLoader';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const VideoToCode: React.FC = () => {
  const [file, setFile] = useState<{data: string, type: string, name: string} | null>(null);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'plan' | 'coding' | 'done'>('upload');
  const [plan, setPlan] = useState<ReverseEngineeringPlan | null>(null);
  const [code, setCode] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  
  // Progress & Logs
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setFile({
            data: ev.target.result as string,
            type: f.type,
            name: f.name
          });
          setStep('upload'); // Ready to analyze
        }
      };
      reader.readAsDataURL(f);
    }
  };

  const startAnalysis = async () => {
      if (!file) return;
      setStep('analyzing');
      setLogs([]);
      setProgress(0);
      
      addLog("بدء المعالجة الجنائية للملف...");
      addLog(`نوع الملف: ${file.type}`);

      // Simulating frame extraction progress
      let p = 0;
      const interval = setInterval(() => {
          p += 5;
          if (p > 90) p = 90;
          setProgress(p);
      }, 300);

      try {
          const analysisResult = await analyzeUiMedia(file.data, file.type);
          clearInterval(interval);
          setProgress(100);
          setPlan(analysisResult);
          setStep('plan');
          addLog("تم اكتمال التحليل بنجاح.");
      } catch (e: any) {
          clearInterval(interval);
          setStep('upload');
          alert("فشل التحليل: " + e.message);
      }
  };

  const startCoding = async () => {
      if (!plan) return;
      setStep('coding');
      setProgress(0);
      addLog("تحويل الخطة إلى كود برمجي...");
      
      try {
          const generated = await generateCodeFromPlan(plan);
          setCode(generated);
          setStep('done');
          addLog("تم بناء الموقع بنجاح.");
      } catch (e: any) {
          setStep('plan');
          alert("فشل كتابة الكود: " + e.message);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-slate-300 font-sans overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-600/20 rounded-lg text-pink-400 border border-pink-500/30">
                    <Icons.Scan size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">المحلل العكسي <span className="text-[10px] text-pink-400 font-mono">REVERSE ENGINEER</span></h2>
                    <p className="text-[10px] text-slate-500">تحليل الفيديو/الصور > استخراج الخطة > نسخ الكود</p>
                </div>
            </div>
            
            {step === 'done' && (
                <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                    <button onClick={() => setViewMode('preview')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-pink-600 text-white' : 'text-slate-500'}`}>
                        <Icons.Monitor size={14} className="inline mr-1"/> معاينة
                    </button>
                    <button onClick={() => setViewMode('code')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'code' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                        <Icons.Code size={14} className="inline mr-1"/> كود
                    </button>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-hidden relative flex">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto custom-scrollbar">
                
                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="w-full max-w-2xl animate-fadeIn">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-pink-500/50 transition-all group bg-black/20"
                        >
                            <input ref={fileInputRef} type="file" hidden accept="image/*,video/*" onChange={handleFileSelect} />
                            
                            {file ? (
                                <div className="text-center">
                                    {file.type.startsWith('video') ? (
                                        <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 mb-4 mx-auto">
                                            <Icons.Video size={32} />
                                        </div>
                                    ) : (
                                        <img src={file.data} className="h-48 rounded-lg shadow-2xl mb-4 border border-white/20 mx-auto" />
                                    )}
                                    <h3 className="text-white font-bold text-lg">{file.name}</h3>
                                    <p className="text-slate-500 text-sm mt-2">اضغط للتغيير</p>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-gradient-to-br from-pink-600/20 to-purple-600/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <Icons.Scan size={40} className="text-pink-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">ارفع فيديو أو صورة للتصميم</h3>
                                    <p className="text-slate-400 text-sm max-w-md text-center">
                                        سيقوم النظام بتحليل الهيكل، الألوان، والحركة إطاراً بإطار، ثم إنشاء نسخة طبق الأصل برمجياً.
                                    </p>
                                </>
                            )}
                        </div>

                        {file && (
                            <button 
                                onClick={startAnalysis}
                                className="w-full mt-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-white shadow-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Scan size={20} />
                                بدء التحليل العميق
                            </button>
                        )}
                    </div>
                )}

                {/* Step 2: Analyzing */}
                {step === 'analyzing' && (
                    <div className="w-full max-w-md text-center">
                        <GlassyLoader text="جاري تشريح واجهة المستخدم..." progress={progress} showSteps size="lg" />
                        <div className="mt-8 h-32 bg-black/40 rounded-xl border border-white/10 p-4 text-left overflow-y-auto custom-scrollbar font-mono text-[10px] text-pink-400">
                             {logs.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    </div>
                )}

                {/* Step 3: Plan Review */}
                {step === 'plan' && plan && (
                    <div className="w-full max-w-4xl animate-fadeIn h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-white">تقرير التحليل الجنائي</h3>
                            <button onClick={startCoding} className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2">
                                <Icons.Code size={18} /> بدء النسخ البرمجي
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar flex-1 pb-10">
                            {/* Colors */}
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Icons.Palette size={14} /> لوحة الألوان
                                </h4>
                                <div className="flex flex-wrap gap-3">
                                    {plan.colors.map((c, i) => (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <div className="w-12 h-12 rounded-lg border border-white/10 shadow-lg" style={{ backgroundColor: c }}></div>
                                            <span className="text-[10px] font-mono text-slate-400">{c}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Layout */}
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Icons.Layout size={14} /> هيكل التصميم
                                </h4>
                                <p className="text-sm text-slate-300 leading-relaxed">{plan.layoutAnalysis}</p>
                            </div>

                            {/* Animations */}
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Icons.Sparkles size={14} /> ديناميكية الحركة
                                </h4>
                                <ul className="space-y-2">
                                    {plan.animations.map((a, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                            <span className="text-pink-500 mt-1">•</span> {a}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Tech Stack */}
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Icons.Cpu size={14} /> التكنولوجيا المقترحة
                                </h4>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 font-mono text-green-400 text-sm">
                                    {plan.techStack}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Coding */}
                {step === 'coding' && (
                    <div className="text-center">
                        <GlassyLoader text="كتابة الكود وربط المكتبات..." size="lg" />
                    </div>
                )}

                {/* Step 5: Done (Preview/Code) */}
                {step === 'done' && (
                    <div className="w-full h-full bg-[#1e1e1e] rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
                        {viewMode === 'preview' ? (
                            <iframe 
                                srcDoc={code} 
                                className="w-full h-full border-none bg-white" 
                                title="Generated UI" 
                                sandbox="allow-scripts"
                            />
                        ) : (
                            <SyntaxHighlighter 
                                language="html" 
                                style={vscDarkPlus} 
                                customStyle={{ margin: 0, padding: '20px', height: '100%', fontSize: '13px' }} 
                                showLineNumbers
                                wrapLines
                            >
                                {code}
                            </SyntaxHighlighter>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};