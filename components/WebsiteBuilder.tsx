import React, { useState, useEffect, useRef } from 'react';
import { generateWebsiteCodeStream, cleanCodeResponse, generateDesignSystem, DesignSystem } from '../services/gemini';
import { Icons } from './Icon';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GlassyLoader } from './GlassyLoader';
import JSZip from 'jszip';

// Options Constants
const FONTS = ['Cairo', 'Tajawal', 'Inter', 'Roboto', 'Open Sans', 'Lato'];
const LIBRARIES = ['FontAwesome', 'AOS (Scroll Anim)', 'GSAP (Advanced Anim)', 'Chart.js', 'Three.js', 'Swiper.js'];
const FRAMEWORKS = ['tailwind', 'bootstrap', 'css'];

export const WebsiteBuilder: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  // Settings
  const [selectedFramework, setSelectedFramework] = useState('tailwind');
  const [selectedFont, setSelectedFont] = useState('Cairo');
  const [selectedLibs, setSelectedLibs] = useState<string[]>([]);
  
  // Design System State
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'designing' | 'building' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isEditMode, setIsEditMode] = useState(false);
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

    setStatus('designing');
    setLogs([]);
    setProgress(0);
    setDesignSystem(null);
    
    try {
      // 1. Design Phase
      addLog("Initializing Graphic Designer AI...", 'design');
      let currentDesign: DesignSystem | undefined;
      
      let p = 0;
      const dInterval = setInterval(() => { p+=10; if(p>90) p=90; setProgress(p); }, 200);

      addLog(`Analyzing request...`, 'design');
      currentDesign = await generateDesignSystem(prompt);
      addLog(`Palette: ${currentDesign.colorPalette.primary}`, 'design');
      
      clearInterval(dInterval);
      setDesignSystem(currentDesign || null);
      setProgress(100);

      // 2. Build Phase
      setStatus('building');
      setViewMode('code');
      addLog("Handing off to Frontend Engineer...", 'info');
      
      const config = { 
          font: selectedFont, 
          libs: selectedLibs, 
          designSystem: currentDesign 
      };

      const stream = await generateWebsiteCodeStream(prompt, generatedCode, selectedFramework, [], config);
      
      let accumulatedCode = '';
      const totalEstimatedChars = 15000;

      for await (const chunk of stream) {
        accumulatedCode += chunk;
        setGeneratedCode(accumulatedCode);

        const currentLength = accumulatedCode.length;
        let prog = (currentLength / totalEstimatedChars) * 100;
        if(prog > 95) prog = 95;
        setProgress(prog);

        if (chunk.includes('<nav') && !logs.some(l=>l.includes('Navbar'))) addLog("Building Navigation...", 'ai');
        if (chunk.includes('script') && !logs.some(l=>l.includes('Logic'))) addLog("Writing Logic...", 'ai');
      }

      setGeneratedCode(cleanCodeResponse(accumulatedCode));
      setStatus('complete');
      setProgress(100);
      addLog("Deployed Successfully.", 'success');
      setViewMode('preview');

    } catch (err: any) {
      addLog(`Critical Error: ${err.message}`, 'error');
      setStatus('idle');
    }
  };

  const downloadProject = async () => {
      if (!generatedCode) return;
      
      const zip = new JSZip();
      let htmlContent = generatedCode;
      
      // Extract Base64 Images and save to assets folder
      let imgCount = 0;
      const assetsFolder = zip.folder("assets");
      
      // Replace base64 src with local paths
      // This Regex looks for src="data:image/..."
      htmlContent = htmlContent.replace(/src=["']data:image\/([a-zA-Z]+);base64,([^"']+)["']/g, (match, ext, data) => {
          imgCount++;
          const filename = `image_${imgCount}.${ext}`;
          if(assetsFolder) assetsFolder.file(filename, data, {base64: true});
          return `src="./assets/${filename}"`;
      });

      // Add index.html
      zip.file("index.html", htmlContent);
      
      // Add Style/CSS file if needed (extracting style tag)
      // For now, we keep it inline for simplicity, but we add a README
      zip.file("README.md", `# Project Generated by Toma Ai\n\n1. Extract all files.\n2. Open index.html in your browser.\n3. Images are located in the 'assets' folder.`);

      // Generate ZIP
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
                    <h2 className="text-sm font-bold text-white tracking-wide">Web Builder <span className="text-[10px] text-slate-500">Single File</span></h2>
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
                 {/* Download Button */}
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
                        <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">Prompt</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your website (e.g. Portfolio for a photographer)..."
                            className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-cyan-500/50 resize-none"
                        />
                    </div>

                    {/* Controls Grid */}
                    <div className="grid grid-cols-2 gap-3">
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

                    {/* Libraries */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Libraries</label>
                        <div className="flex flex-wrap gap-2">
                            {LIBRARIES.map(lib => (
                                <button 
                                    key={lib} 
                                    onClick={() => toggleLib(lib)}
                                    className={`px-2 py-1 text-[10px] rounded-md border transition-all ${selectedLibs.includes(lib) ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
                                >
                                    {lib}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Generate Button */}
                    <button 
                        onClick={handleGenerate}
                        disabled={status !== 'idle' && status !== 'complete'}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${status !== 'idle' && status !== 'complete' ? 'bg-white/5 text-slate-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'}`}
                    >
                         {status !== 'idle' && status !== 'complete' ? <Icons.Loader size={16} className="animate-spin"/> : <Icons.Play size={16} />}
                         {status === 'designing' ? 'Designing...' : status === 'building' ? 'Building...' : 'Generate Website'}
                    </button>

                    {/* Logs Area (Replaces Terminal) */}
                    <div className="mt-2 flex-1 min-h-[150px] bg-black/40 rounded-xl border border-white/5 p-2 flex flex-col">
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                             <Icons.Terminal size={12} className="text-slate-500"/>
                             <span className="text-[10px] font-bold text-slate-500 uppercase">System Logs</span>
                         </div>
                         <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1" ref={logsContainerRef}>
                             {logs.length === 0 && <span className="text-slate-700 italic">Ready to build...</span>}
                             {logs.map((log, i) => (
                                 <div key={i} className="text-slate-400 whitespace-nowrap">{log}</div>
                             ))}
                         </div>
                    </div>

                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] relative">
                
                {status === 'designing' && (
                     <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                         <GlassyLoader text="Graphic Designer AI is creating the Design System..." progress={progress} showSteps />
                     </div>
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