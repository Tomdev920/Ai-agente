import React, { useState, useEffect, useRef } from 'react';
import { generateWebsiteCodeStream, cleanCodeResponse, generateDesignSystem, DesignSystem } from '../services/gemini';
import { Icons } from './Icon';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';

// Options Constants
const FONTS = ['Cairo', 'Tajawal', 'Inter', 'Roboto', 'Open Sans', 'Lato'];
const LIBRARIES = ['FontAwesome', 'AOS (Scroll Anim)', 'GSAP (Advanced Anim)', 'Chart.js', 'Three.js', 'Swiper.js', 'Framer Motion'];
const FRAMEWORKS = ['tailwind', 'bootstrap', 'css'];

// AI Agent Avatar Component
const AgentOverlay: React.FC<{ 
  role: 'designer' | 'developer' | 'manager'; 
  status: string; 
  progress: number;
}> = ({ role, status, progress }) => {
    
    // Anime Avatars (Heeba/Cool Style)
    // Designer = Creative Anime Girl with vibrant colors
    // Developer = Dark/Cool Anime Guy (Hacker vibe)
    const avatarUrl = role === 'designer' 
        ? "https://api.dicebear.com/9.x/lorelei/svg?seed=Amara&backgroundColor=b6e3f4&hair=freckles&mouth=happy04&eyes=happy12" 
        : role === 'developer'
        ? "https://api.dicebear.com/9.x/lorelei/svg?seed=Felix&backgroundColor=1a1a1a&hair=bedhead&eyes=surprised01&mouth=sad01&glasses=round" 
        : "https://robohash.org/manager_owl?set=set1&size=300x300&bgset=bg1";

    const roleName = role === 'designer' ? "المصممة المبدعة (Aya)" : "كبير المطورين (Zero)";
    const roleColor = role === 'designer' ? "text-purple-400" : "text-cyan-400";
    const bgColor = role === 'designer' ? "bg-purple-600" : "bg-cyan-600";
    const gradient = role === 'designer' ? "from-purple-600 to-pink-600" : "from-cyan-600 to-blue-600";

    return (
        <div className="absolute inset-0 z-50 bg-[#09090b]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fadeIn">
            
            {/* Avatar Circle with Glow */}
            <div className="relative mb-8 group">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-tr ${gradient} blur-3xl opacity-50 animate-pulse`}></div>
                <div className={`relative w-48 h-48 rounded-full border-4 border-white/10 bg-[#1a1a1a] overflow-hidden shadow-2xl flex items-center justify-center`}>
                     <img 
                        src={avatarUrl} 
                        alt={role} 
                        className="w-full h-full object-cover animate-float"
                     />
                </div>
                {/* Badge */}
                <div className={`absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-2 rounded-full ${bgColor} text-white text-sm font-bold border border-white/20 shadow-lg whitespace-nowrap`}>
                    {role === 'designer' ? <Icons.Palette size={16} className="inline mr-2"/> : <Icons.Cpu size={16} className="inline mr-2"/>}
                    {role === 'designer' ? 'LEAD DESIGNER' : 'SENIOR DEV'}
                </div>
            </div>

            {/* Status Card */}
            <div className="w-full max-w-lg bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className={`text-xl font-bold ${roleColor}`}>{roleName}</h3>
                    <div className="flex items-center gap-2">
                         <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                         <span className="text-xs font-mono text-slate-500">CONNECTED</span>
                    </div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-5 mb-6 border border-white/5 flex items-start gap-4">
                    <Icons.Terminal className={`mt-1 flex-shrink-0 ${roleColor}`} size={18} />
                    <p className="text-base text-slate-200 leading-relaxed font-light" dir="auto">
                        "{status}"
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 font-mono uppercase tracking-wider">
                        <span>System_Activity</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className={`h-full bg-gradient-to-r ${gradient} transition-all duration-300 relative`}
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const WebsiteBuilder: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  // Settings
  const [selectedFramework, setSelectedFramework] = useState('tailwind');
  const [selectedFont, setSelectedFont] = useState('Cairo');
  const [selectedLibs, setSelectedLibs] = useState<string[]>([]);
  
  // Design System State
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  
  // Agent State
  const [activeAgent, setActiveAgent] = useState<{
      role: 'designer' | 'developer' | 'manager';
      status: string;
  } | null>(null);

  const [status, setStatus] = useState<'idle' | 'designing' | 'building' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsContainerRef.current) logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (status === 'building' && codeContainerRef.current) codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
  }, [generatedCode, status]);

  const addLog = (msg: string, type: 'info' | 'ai' | 'design' | 'error' | 'success' = 'info') => {
      const prefix = type === 'ai' ? '🤖' : type === 'design' ? '🎨' : type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${prefix} ${msg}`]);
  };

  const toggleLib = (lib: string) => {
      setSelectedLibs(prev => prev.includes(lib) ? prev.filter(l => l !== lib) : [...prev, lib]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || status === 'building') return;

    // --- CHECK IF EDIT MODE OR NEW BUILD ---
    const isEditing = !!generatedCode;

    if (isEditing) {
        // --- EDIT MODE FLOW ---
        setStatus('building');
        setLogs([]);
        setProgress(0);
        
        setActiveAgent({ 
            role: 'developer', 
            status: 'فهمت التعديل المطلوب. جاري تحليل الكود الحالي لتطبيق التغييرات...' 
        });
        addLog("Initializing Edit Protocol...", 'info');

        try {
             // Skip Design Phase for Edits
             const config = { 
                font: selectedFont, 
                libs: selectedLibs, 
                designSystem: designSystem || undefined 
            };

            const stream = await generateWebsiteCodeStream(prompt, generatedCode, selectedFramework, [], config);
            
            let accumulatedCode = '';
            for await (const chunk of stream) {
                accumulatedCode += chunk;
                setGeneratedCode(accumulatedCode);
                
                // Faster progress for editing
                setProgress(prev => Math.min(prev + 2, 95));

                if (chunk.includes('<') && !logs.some(l=>l.includes('Updating'))) {
                     setActiveAgent(prev => ({...prev!, status: 'تطبيق التعديلات على الهيكل...'}));
                     addLog("Modifying DOM Structure...", 'ai');
                }
            }
            
            setGeneratedCode(cleanCodeResponse(accumulatedCode));
            setActiveAgent(prev => ({...prev!, status: 'تم التعديل بنجاح. جاري التحديث...'}));
            setProgress(100);
            await new Promise(r => setTimeout(r, 800));

            setStatus('complete');
            setActiveAgent(null);
            addLog("Update Deployed Successfully.", 'success');
            setPrompt(''); // Clear prompt after success

        } catch (err: any) {
            addLog(`Update Error: ${err.message}`, 'error');
            setStatus('idle');
            setActiveAgent(null);
        }

    } else {
        // --- NEW BUILD FLOW (Existing Logic) ---
        setStatus('designing');
        setLogs([]);
        setProgress(0);
        setDesignSystem(null);
        
        setActiveAgent({ 
            role: 'designer', 
            status: 'جاري تحليل الفكرة واختيار الألوان المناسبة...' 
        });

        try {
            // 1. Design Phase
            addLog("Initializing Graphic Designer AI...", 'design');
            
            let p = 0;
            const dInterval = setInterval(() => { 
                p+=5; 
                if(p>90) p=90; 
                setProgress(p); 
                if(p === 30) setActiveAgent(prev => ({...prev!, status: 'اختيار الخطوط والمسافات...'}));
                if(p === 60) setActiveAgent(prev => ({...prev!, status: 'رسم التخطيط المبدئي (Wireframe)...'}));
            }, 100);

            const currentDesign = await generateDesignSystem(prompt);
            
            clearInterval(dInterval);
            setProgress(100);
            setDesignSystem(currentDesign || null);
            addLog(`Palette: ${currentDesign.colorPalette.primary}`, 'design');
            
            setActiveAgent(prev => ({...prev!, status: 'تم الانتهاء من التصميم! تسليم المهمة للمطور...'}));
            await new Promise(r => setTimeout(r, 1500));

            // 2. Build Phase
            setStatus('building');
            setViewMode('code');
            setActiveAgent({ 
                role: 'developer', 
                status: 'استلمت التصميم. جاري كتابة كود الهيكل (HTML)...' 
            });
            setProgress(0);
            addLog("Handing off to Frontend Engineer...", 'info');
            
            const config = { 
                font: selectedFont, 
                libs: selectedLibs, 
                designSystem: currentDesign 
            };

            const stream = await generateWebsiteCodeStream(prompt, '', selectedFramework, [], config);
            
            let accumulatedCode = '';
            for await (const chunk of stream) {
                accumulatedCode += chunk;
                setGeneratedCode(accumulatedCode);
                
                const currentLength = accumulatedCode.length;
                let prog = (currentLength / 15000) * 100;
                if(prog > 95) prog = 95;
                setProgress(prog);

                if (chunk.includes('<nav') && !logs.some(l=>l.includes('Navbar'))) {
                    setActiveAgent(prev => ({...prev!, status: 'بناء شريط التنقل والقوائم...'}));
                    addLog("Building Navigation...", 'ai');
                }
                if (chunk.includes('<footer') && !logs.some(l=>l.includes('Footer'))) {
                    setActiveAgent(prev => ({...prev!, status: 'تجهيز الفوتر والروابط...'}));
                }
                if (chunk.includes('script') && !logs.some(l=>l.includes('Logic'))) {
                    setActiveAgent(prev => ({...prev!, status: 'كتابة منطق الجافاسكريبت والتفاعلات...'}));
                    addLog("Writing Logic...", 'ai');
                }
            }

            setGeneratedCode(cleanCodeResponse(accumulatedCode));
            
            setActiveAgent(prev => ({...prev!, status: 'مراجعة الكود وتشغيل الموقع...'}));
            setProgress(100);
            await new Promise(r => setTimeout(r, 1000));

            setStatus('complete');
            setActiveAgent(null);
            addLog("Deployed Successfully.", 'success');
            setViewMode('preview');
            setPrompt(''); // Clear prompt

        } catch (err: any) {
            addLog(`Critical Error: ${err.message}`, 'error');
            setStatus('idle');
            setActiveAgent(null);
        }
    }
  };

  const downloadProject = async () => {
      if (!generatedCode) return;
      const zip = new JSZip();
      const singleFileFolder = zip.folder("single_file");
      if (singleFileFolder) {
          singleFileFolder.file("index.html", generatedCode);
      }
      const sourceFolder = zip.folder("source_code");
      if (sourceFolder) {
          let htmlContent = generatedCode;
          let cssContent = "";
          let jsContent = "";
          const cssMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
          if (cssMatch && cssMatch[1]) {
              cssContent = cssMatch[1];
              htmlContent = htmlContent.replace(cssMatch[0], '<link rel="stylesheet" href="./css/style.css">');
          }
          const jsMatch = htmlContent.match(/<script>(?![\s\S]*src=)([\s\S]*?)<\/script>/i);
          if (jsMatch && jsMatch[1]) {
               jsContent = jsMatch[1];
               htmlContent = htmlContent.replace(jsMatch[0], '<script src="./js/script.js"></script>');
          }
          const assetsFolder = sourceFolder.folder("assets");
          const cssFolder = sourceFolder.folder("css");
          const jsFolder = sourceFolder.folder("js");
          let imgCount = 0;
          htmlContent = htmlContent.replace(/src=["']data:image\/([a-zA-Z]+);base64,([^"']+)["']/g, (match, ext, data) => {
              imgCount++;
              const filename = `image_${imgCount}.${ext}`;
              if (assetsFolder) assetsFolder.file(filename, data, {base64: true});
              return `src="./assets/${filename}"`;
          });
          sourceFolder.file("index.html", htmlContent);
          if (cssFolder) cssFolder.file("style.css", cssContent);
          if (jsFolder) jsFolder.file("script.js", jsContent);
      }
      const content = await zip.generateAsync({type:"blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "toma_website_project.zip";
      link.click();
      addLog("Project ZIP downloaded successfully.", 'success');
  };

  const getPreviewCode = () => {
     if (!generatedCode) return '';
     return cleanCodeResponse(generatedCode);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-slate-300 font-sans overflow-hidden">
        {/* Top Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`p-1.5 rounded-lg border transition-all ${showSidebar ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                >
                    <Icons.Layout size={18} />
                </button>
                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                <div className="p-1.5 bg-cyan-600/20 rounded-lg text-cyan-400 border border-cyan-500/30">
                    <Icons.Globe size={20} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Web Builder <span className="text-[10px] text-slate-500">Intelligent</span></h2>
                </div>
            </div>

            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                <button onClick={() => setViewMode('preview')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>
                    <Icons.Monitor size={14} className="inline mr-1"/> Preview
                </button>
                <button onClick={() => setViewMode('code')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'code' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>
                    <Icons.Code size={14} className="inline mr-1"/> Code
                </button>
            </div>
            
            <div className="flex gap-2">
                {generatedCode && (
                    <button onClick={downloadProject} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                        <Icons.Download size={14} /> <span className="hidden sm:inline">Export ZIP</span>
                    </button>
                )}
                <button onClick={() => setDevice(device === 'desktop' ? 'mobile' : 'desktop')} className={`p-2 rounded-lg border transition-all ${device === 'mobile' ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'bg-white/5 text-slate-400 border-transparent'}`}>
                    {device === 'desktop' ? <Icons.Monitor size={16} /> : <Icons.Smartphone size={16} />}
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Controls */}
            <div className={`${showSidebar ? 'w-80 border-r border-white/5 opacity-100' : 'w-0 border-none opacity-0'} bg-black/20 flex flex-col transition-all duration-300 overflow-hidden`}>
                <div className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    {/* Prompt */}
                    <div>
                        <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">
                            {generatedCode ? 'Edit Instructions (Modify)' : 'New Website Prompt'}
                        </label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={generatedCode ? "مثلاً: غير لون الخلفية إلى الأسود، أضف قسم خدمات جديد..." : "صف موقعك (مثلاً: موقع شخصي لمصور فوتوغرافي)..."}
                            className={`w-full h-24 bg-white/5 border rounded-xl p-3 text-sm text-white focus:ring-1 resize-none transition-colors ${generatedCode ? 'border-purple-500/30 focus:ring-purple-500/50' : 'border-white/10 focus:ring-cyan-500/50'}`}
                            dir="auto"
                        />
                    </div>

                    {/* Generate Button */}
                    <button 
                        onClick={handleGenerate}
                        disabled={status !== 'idle' && status !== 'complete'}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all 
                        ${status !== 'idle' && status !== 'complete' 
                            ? 'bg-white/5 text-slate-500' 
                            : generatedCode 
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/20' 
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20'}`}
                    >
                         {status !== 'idle' && status !== 'complete' ? <Icons.Loader size={16} className="animate-spin"/> : (generatedCode ? <Icons.Sparkles size={16} /> : <Icons.Play size={16} />)}
                         {status === 'designing' || status === 'building' 
                            ? (generatedCode ? 'Applying Fixes...' : 'Building...') 
                            : (generatedCode ? 'Update Website' : 'Generate Website')}
                    </button>
                    
                    {generatedCode && (
                        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <h4 className="text-[10px] font-bold text-purple-400 mb-1 flex items-center gap-1"><Icons.Sparkles size={10}/> Edit Mode Active</h4>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                اكتب التعديلات في المربع أعلاه واضغط Update. سيقوم الذكاء الاصطناعي بتعديل الجزء المطلوب فقط.
                            </p>
                        </div>
                    )}

                    {/* Controls Grid */}
                    <div className="grid grid-cols-2 gap-3 opacity-80 hover:opacity-100 transition-opacity">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Framework</label>
                            <div className="flex flex-col gap-1">
                                {FRAMEWORKS.map(f => (
                                    <button 
                                        key={f} 
                                        onClick={() => setSelectedFramework(f)}
                                        className={`px-2 py-1.5 text-[10px] rounded-lg border text-left transition-all ${selectedFramework === f ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-transparent text-slate-400'}`}
                                    >
                                        {f.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Font</label>
                             <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                {FONTS.map(f => (
                                    <button 
                                        key={f} 
                                        onClick={() => setSelectedFont(f)}
                                        className={`px-2 py-1.5 text-[10px] rounded-lg border text-left transition-all ${selectedFont === f ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/5 border-transparent text-slate-400'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Libraries Selection */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Libraries</label>
                        <div className="flex flex-wrap gap-2">
                            {LIBRARIES.map(lib => (
                                <button 
                                    key={lib}
                                    onClick={() => toggleLib(lib)}
                                    className={`px-2 py-1 text-[9px] rounded-lg border transition-all ${selectedLibs.includes(lib) ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                                >
                                    {lib}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Logs Area */}
                    <div className="mt-2 flex-1 min-h-[150px] bg-black/40 rounded-xl border border-white/5 p-2 flex flex-col">
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                             <Icons.Terminal size={12} className="text-slate-500"/>
                             <span className="text-[10px] font-bold text-slate-500 uppercase">System Logs</span>
                         </div>
                         <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1" ref={logsContainerRef}>
                             {logs.length === 0 && <span className="text-slate-700 italic">Ready...</span>}
                             {logs.map((log, i) => (
                                 <div key={i} className="text-slate-400 whitespace-nowrap">{log}</div>
                             ))}
                         </div>
                    </div>

                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] relative">
                
                {/* AI AGENT OVERLAY */}
                {activeAgent && (
                     <AgentOverlay 
                        role={activeAgent.role} 
                        status={activeAgent.status} 
                        progress={progress} 
                     />
                )}

                {viewMode === 'preview' ? (
                     <div className="flex-1 flex items-center justify-center bg-[#0e0e0e] overflow-auto p-4">
                         {generatedCode ? (
                             <div className={`transition-all duration-300 bg-white shadow-2xl overflow-hidden ${device === 'mobile' ? 'w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]' : 'w-full h-full rounded-lg border border-white/10'}`}>
                                 <iframe 
                                     srcDoc={getPreviewCode()} 
                                     className="w-full h-full border-none" 
                                     title="Preview" 
                                     sandbox="allow-scripts" 
                                 />
                             </div>
                         ) : (
                             <div className="text-center text-slate-600">
                                 <Icons.Layout size={48} className="mx-auto mb-4 opacity-20" />
                                 <p className="text-sm">Enter a prompt to generate a website</p>
                             </div>
                         )}
                     </div>
                ) : (
                    <div className="flex-1 overflow-auto custom-scrollbar relative" ref={codeContainerRef}>
                        <SyntaxHighlighter 
                            language="html" 
                            style={vscDarkPlus} 
                            customStyle={{ margin: 0, padding: '20px', minHeight: '100%', fontSize: '13px', background: 'transparent' }} 
                            showLineNumbers
                            wrapLines
                        >
                            {generatedCode || '<!-- Code will appear here -->'}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};