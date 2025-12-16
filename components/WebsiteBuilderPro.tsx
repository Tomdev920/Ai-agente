import React, { useState, useEffect, useRef } from 'react';
import { generateNextJsProject, updateProjectFile, ProjectFile, GenerationPlan } from '../services/gemini';
import { Icons } from './Icon';
import { GlassyLoader } from './GlassyLoader';
import JSZip from 'jszip';

interface WebsiteBuilderProProps {}

const TEMPLATES = [
    { title: "AI SaaS Dashboard", prompt: "Modern AI Analytics Dashboard with dark mode, sidebar, charts placeholders, and neon accents. Multi-page structure with Dashboard, Analytics, and Settings pages." },
    { title: "3D Creative Portfolio", prompt: "High-end creative portfolio. Pages: Home, Work (Grid), About, Contact. Use parallax scrolling effects." },
    { title: "Crypto Exchange", prompt: "Professional Cryptocurrency exchange. Pages: Markets, Trading View, Wallet, Profile." },
    { title: "E-commerce Pro", prompt: "Luxury fashion e-commerce. Pages: Home, Shop (Grid), Product Details, Cart, Checkout." },
    { title: "Learning Platform (LMS)", prompt: "Online course platform. Pages: Course List, Video Player, User Dashboard." },
];

export const WebsiteBuilderPro: React.FC<WebsiteBuilderProProps> = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'planning' | 'generating' | 'ready'>('idle');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [previewHTML, setPreviewHTML] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('preview');
  const [logs, setLogs] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  // New States for Pro Max
  const [mediaFiles, setMediaFiles] = useState<{data: string, type: string}[]>([]);
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true); // Sidebar Toggle State

  // Progress
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Click-to-Edit Listener for Iframe
    const handleMessage = (e: MessageEvent) => {
        if(e.data?.type === 'ELEMENT_CLICKED' && editMode) {
             const { tagName, text, id } = e.data;
             const identifier = id ? `(#${id})` : '';
             const textSample = text ? ` containing "${text.substring(0, 15)}..."` : '';
             setPrompt(`Update ${tagName}${identifier}${textSample}: `);
             if (promptInputRef.current) promptInputRef.current.focus();
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [editMode]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              if(ev.target?.result) {
                  setMediaFiles(prev => [...prev, { data: ev.target!.result as string, type: file.type }]);
                  addLog("Image attached for analysis.");
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if(!selectedFile) return;
      const newContent = e.target.value;
      const updatedFiles = files.map(f => f.path === selectedFile.path ? {...f, content: newContent} : f);
      setFiles(updatedFiles);
      setSelectedFile({...selectedFile, content: newContent});
  };

  const startPlanning = async () => {
      if(!prompt.trim() && mediaFiles.length === 0) return;
      
      setStatus('planning');
      setPlan(null);
      setLogs([]);
      addLog("Analyzing requirements & visual context...");
      
      try {
          // Pass 'plan' mode
          const planData = await generateNextJsProject(prompt, [], mediaFiles.map(m => m.data), 'plan');
          setPlan(planData);
          addLog("Plan generated successfully.");
      } catch (e: any) {
          setStatus('idle');
          alert("Planning failed: " + e.message);
      }
  };

  const handleGenerateBuild = async () => {
      if(!plan) return;
      
      setStatus('generating');
      setProgress(0);
      
      addLog(`Executing Plan: ${plan.title}`);
      
      // Handle architecture log safely
      const archLog = typeof plan.architecture === 'string' 
        ? plan.architecture 
        : 'Microservices / Modular Architecture';
      addLog(`Architecture: ${archLog}`);

      // Simulate steps
      let p = 0;
      const interval = setInterval(() => {
          p += 2;
          if (p > 95) p = 95;
          setProgress(p);
      }, 300);

      try {
          // Pass 'build' mode with plan context
          const result = await generateNextJsProject(prompt, files, mediaFiles.map(m => m.data), 'build', plan);
          
          clearInterval(interval);
          setProgress(100);
          
          setFiles(result.files);
          setPreviewHTML(result.previewHTML);
          
          // Auto-select page.tsx or first file
          const mainFile = result.files.find(f => f.path.includes('page.tsx')) || result.files[0];
          setSelectedFile(mainFile);
          
          setStatus('ready');
          setPlan(null); // Clear plan overlay
          addLog("Build Complete.");

      } catch (e: any) {
          clearInterval(interval);
          setStatus('idle');
          addLog(`Error: ${e.message}`);
          alert("Generation failed. Please try again.");
      }
  };

  const handleUpdateFile = async () => {
      if(!selectedFile || !prompt.trim()) return;
      setStatus('generating');
      addLog(`Modifying ${selectedFile.path}...`);
      
      try {
          const newContent = await updateProjectFile(prompt, selectedFile);
          const newFiles = files.map(f => f.path === selectedFile.path ? { ...f, content: newContent } : f);
          setFiles(newFiles);
          setSelectedFile({ ...selectedFile, content: newContent });
          setStatus('ready');
          addLog("File updated.");
          setPrompt('');
      } catch (e) {
          setStatus('ready');
      }
  };

  const downloadProject = async () => {
      const zip = new JSZip();
      files.forEach(f => {
          zip.file(f.path, f.content);
      });
      // Add standard instructions
      // Handle architecture safely for README
      const archText = typeof plan?.architecture === 'string' 
        ? plan.architecture 
        : JSON.stringify(plan?.architecture, null, 2);

      zip.file("README.md", `# ${plan?.title || 'Toma Ai Project'}\n\nGenerated by Toma Ai Pro.\n\n## Tech Stack\n${archText || 'Next.js 14, Tailwind, Prisma'}\n\n## Setup\n1. \`npm install\`\n2. \`npx prisma generate\`\n3. \`npm run dev\``);
      
      const content = await zip.generateAsync({type:"blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "nextjs-pro-project.zip";
      link.click();
  };

  const getPreviewSrc = () => {
      const script = `
        <script>
            document.addEventListener('click', (e) => {
                const target = e.target.closest('a');
                if (target) {
                   // Handle navigation simulation if implemented
                }
                
                e.preventDefault(); e.stopPropagation();
                window.parent.postMessage({
                    type: 'ELEMENT_CLICKED', tagName: e.target.tagName, id: e.target.id, text: e.target.innerText
                }, '*');
            }, true);
        </script>
      `;
      return editMode ? previewHTML + script : previewHTML;
  };

  // Safe Architecture Renderer
  const renderArchitecture = (arch: any) => {
      if (typeof arch === 'string') return arch;
      if (typeof arch === 'object' && arch !== null) {
          return (
              <div className="flex flex-col gap-1.5">
                  {Object.entries(arch).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:gap-2 border-b border-white/5 pb-1 last:border-0">
                          <span className="text-blue-300 font-bold uppercase text-[10px] w-28 shrink-0">{key.replace(/_/g, ' ')}</span>
                          <span className="text-slate-400 text-xs">{String(value)}</span>
                      </div>
                  ))}
              </div>
          );
      }
      return String(arch);
  };

  // Safe Step Renderer
  const renderStep = (step: any) => {
      if (typeof step === 'string') return step;
      if (typeof step === 'object' && step !== null) {
          const text = step.details || step.description || '';
          const prefix = step.phase ? `[${step.phase}] ` : '';
          return prefix + text || JSON.stringify(step);
      }
      return String(step);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-slate-300 font-sans overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`p-1.5 rounded-lg border transition-all ${showSidebar ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  title="Toggle File Explorer"
                >
                    <Icons.Folder size={18} />
                </button>
                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-400 border border-blue-500/30">
                    <Icons.Rocket size={20} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Next.js Node Builder</h2>
                    <p className="text-[10px] text-slate-500">Multi-Page • App Router • Server Components</p>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={downloadProject} className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                    <Icons.Download size={14} /> Export ZIP
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            
            {/* PLAN OVERLAY */}
            {status === 'planning' && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-8">
                     {!plan ? (
                         <GlassyLoader text="Analyzing Requirements & Creating Roadmap..." />
                     ) : (
                         <div className="w-full max-w-2xl bg-[#09090b] border border-blue-500/30 rounded-2xl p-6 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
                             <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                                 <div className="p-2 bg-blue-600 rounded-lg"><Icons.Plan size={24} className="text-white"/></div>
                                 <div>
                                     <h2 className="text-xl font-bold text-white">{plan.title}</h2>
                                     <p className="text-xs text-slate-400">{plan.description}</p>
                                 </div>
                             </div>
                             
                             <div className="mb-6">
                                 <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Architecture</h3>
                                 <div className="p-3 bg-white/5 rounded-lg text-sm text-slate-300 border border-white/5 font-mono">
                                     {renderArchitecture(plan.architecture)}
                                 </div>
                             </div>

                             <div className="mb-8">
                                 <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Implementation Steps</h3>
                                 <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                     {plan.steps.map((step, i) => (
                                         <div key={i} className="flex gap-3 items-center p-2 rounded hover:bg-white/5">
                                             <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">{i+1}</div>
                                             <span className="text-sm text-slate-300">{renderStep(step)}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>

                             <div className="flex gap-3">
                                 <button onClick={() => setStatus('idle')} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-sm">Cancel</button>
                                 <button onClick={handleGenerateBuild} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                                     <Icons.Cpu size={16} /> Approve & Build
                                 </button>
                             </div>
                         </div>
                     )}
                </div>
            )}

            {/* Sidebar: File Explorer with Toggle Animation */}
            <div className={`${showSidebar ? 'w-64 border-r border-white/5 opacity-100' : 'w-0 border-none opacity-0'} bg-black/20 flex flex-col transition-all duration-300 overflow-hidden`}>
                <div className="p-3 border-b border-white/5 flex items-center justify-between min-w-[16rem]">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Explorer</span>
                    <Icons.More size={14} className="text-slate-600" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-w-[16rem]">
                    {files.length === 0 ? (
                        <div className="text-center mt-10 text-[10px] text-slate-600">
                            No files generated yet.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {files.map((file) => (
                                <button
                                    key={file.path}
                                    onClick={() => { setSelectedFile(file); setActiveTab('editor'); }}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left truncate transition-all ${selectedFile?.path === file.path ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}
                                >
                                    {file.path.endsWith('.tsx') ? <Icons.File className="text-blue-400" size={14}/> : 
                                     file.path.endsWith('.ts') ? <Icons.Code className="text-blue-400" size={14}/> :
                                     file.path.includes('json') ? <Icons.Settings className="text-yellow-400" size={14}/> :
                                     <Icons.File size={14} />}
                                    <span className="truncate">{file.path}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* Tabs & Content */}
                {status === 'generating' ? (
                     <div className="flex-1 flex flex-col items-center justify-center relative">
                         <GlassyLoader text="Building Project Structure..." size="lg" progress={progress} showSteps />
                         <div className="mt-4 h-32 w-2/3 bg-black/50 border border-white/10 rounded-xl p-4 overflow-y-auto custom-scrollbar font-mono text-[10px] text-green-400">
                             {logs.map((l, i) => <div key={i}>{l}</div>)}
                         </div>
                     </div>
                ) : files.length > 0 ? (
                    <>
                        <div className="h-10 bg-black/40 border-b border-white/5 flex items-center justify-between px-4">
                             <div className="flex gap-4 h-full">
                                 <button 
                                   onClick={() => setActiveTab('preview')}
                                   className={`h-full border-b-2 px-4 text-xs font-bold flex items-center gap-2 ${activeTab === 'preview' ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                 >
                                     <Icons.Play size={14} /> Live Preview
                                 </button>
                                 <button 
                                   onClick={() => setActiveTab('editor')}
                                   className={`h-full border-b-2 px-4 text-xs font-bold flex items-center gap-2 ${activeTab === 'editor' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                 >
                                     <Icons.Code size={14} /> Code Editor
                                 </button>
                             </div>
                             
                             {activeTab === 'preview' && (
                                 <button onClick={() => setEditMode(!editMode)} className={`text-[10px] px-3 py-1 rounded-full border transition-all ${editMode ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-white/5 text-slate-500 border-transparent'}`}>
                                     {editMode ? 'Click Element to Edit' : 'View Only'}
                                 </button>
                             )}
                        </div>

                        <div className="flex-1 bg-[#1e1e1e] overflow-hidden relative">
                             {activeTab === 'preview' ? (
                                 <iframe 
                                    srcDoc={getPreviewSrc()} 
                                    className="w-full h-full border-none bg-white" 
                                    title="Live Preview"
                                    sandbox="allow-scripts"
                                 />
                             ) : (
                                 <div className="w-full h-full relative">
                                    <div className="absolute top-0 right-0 p-2 z-10">
                                         <span className="text-[10px] text-slate-500 font-mono bg-black/50 px-2 py-1 rounded">{selectedFile?.path}</span>
                                    </div>
                                    <textarea
                                        className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none leading-relaxed"
                                        spellCheck={false}
                                        value={selectedFile?.content || ''}
                                        onChange={handleContentChange}
                                        placeholder="// Select a file to view and edit code..."
                                    />
                                 </div>
                             )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative">
                         {/* Empty State / Welcome */}
                         <div className="absolute inset-0 overflow-hidden pointer-events-none">
                             <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
                             <div className="absolute top-40 -left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"></div>
                         </div>
                         
                         <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-3xl flex items-center justify-center mb-6 border border-blue-500/20 relative z-10">
                             <Icons.Rocket size={48} className="text-blue-400" />
                         </div>
                         <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Next.js 14 Pro Architect</h3>
                         <p className="text-slate-400 max-w-md text-sm mb-8 relative z-10">
                             Generate full-stack ready projects with Prisma, Zod, and Shadcn UI. 
                             Now with <span className="text-blue-400 font-bold">Image to Code</span> and <span className="text-purple-400 font-bold">Architect Planning</span>.
                         </p>

                         {/* Quick Templates */}
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl w-full relative z-10">
                             {TEMPLATES.slice(0, 3).map((t, i) => (
                                 <button 
                                    key={i} 
                                    onClick={() => setPrompt(t.prompt)}
                                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 rounded-xl text-left transition-all group"
                                 >
                                     <div className="text-xs font-bold text-white mb-1 group-hover:text-blue-400">{t.title}</div>
                                     <div className="text-[10px] text-slate-500 line-clamp-2">{t.prompt}</div>
                                 </button>
                             ))}
                         </div>
                    </div>
                )}

                {/* Prompt Area */}
                <div className="h-auto min-h-[80px] border-t border-white/10 bg-black/60 backdrop-blur p-4 relative z-20">
                    {mediaFiles.length > 0 && (
                        <div className="flex gap-2 mb-2 overflow-x-auto">
                            {mediaFiles.map((f, i) => (
                                <div key={i} className="relative w-12 h-12 rounded-lg border border-blue-500/30 overflow-hidden group">
                                    <img src={f.data} className="w-full h-full object-cover" />
                                    <button onClick={() => setMediaFiles(mediaFiles.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400">
                                        <Icons.Close size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="max-w-4xl mx-auto flex gap-3 items-end">
                         {/* Tools */}
                         <div className="flex gap-1">
                             <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
                             <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all" title="Upload Image Context">
                                 <Icons.Image size={20} className={mediaFiles.length > 0 ? "text-blue-400" : ""} />
                             </button>
                             <button onClick={() => setShowTemplates(!showTemplates)} className={`p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all relative ${showTemplates ? 'text-purple-400' : ''}`} title="Templates">
                                 <Icons.Template size={20} />
                                 {showTemplates && (
                                     <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#111] border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1">
                                         {TEMPLATES.map((t, i) => (
                                             <button key={i} onClick={() => { setPrompt(t.prompt); setShowTemplates(false); }} className="text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 rounded-lg">
                                                 {t.title}
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </button>
                         </div>

                         <div className="flex-1 relative">
                             <textarea 
                               id="pro-prompt"
                               ref={promptInputRef}
                               value={prompt}
                               onChange={(e) => setPrompt(e.target.value)}
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter' && !e.shiftKey) {
                                       e.preventDefault();
                                       files.length > 0 ? handleUpdateFile() : startPlanning();
                                   }
                               }}
                               placeholder={files.length > 0 ? "Modify current file..." : "Describe your SaaS/App idea or upload an image..."}
                               className="w-full h-12 py-3 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:ring-1 focus:ring-blue-500/50 outline-none resize-none custom-scrollbar"
                             />
                         </div>
                         <button 
                            onClick={files.length > 0 ? handleUpdateFile : startPlanning}
                            disabled={!prompt.trim() && mediaFiles.length === 0}
                            className={`px-6 h-12 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${files.length > 0 ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
                         >
                             {status === 'generating' || status === 'planning' ? <Icons.Loader className="animate-spin" /> : <Icons.Send />}
                         </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};