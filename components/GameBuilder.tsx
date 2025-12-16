import React, { useState, useEffect, useRef } from 'react';
import { generateGameCodeStream, cleanCodeResponse, generateImage, analyzeGameAssets } from '../services/gemini';
import { Icons } from './Icon';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GlassyLoader } from './GlassyLoader';
import { ThreeDAssetGen } from './ThreeDAssetGen';

type GameDimension = '2d' | '3d';
type GameEngine = 'threejs' | 'babylonjs' | 'aframe' | 'phaser' | 'kaboom' | 'canvas';

interface GameBuilderProps {
  initialDimension?: GameDimension;
}

export const GameBuilder: React.FC<GameBuilderProps> = ({ initialDimension = '3d' }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  // Settings
  const [dimension, setDimension] = useState<GameDimension>(initialDimension);
  const [engine, setEngine] = useState<GameEngine>(initialDimension === '2d' ? 'phaser' : 'threejs');
  const [extraLibs, setExtraLibs] = useState<string[]>([]);
  
  // Advanced Building State
  const [buildState, setBuildState] = useState<'idle' | 'analyzing' | 'generating_assets' | 'coding' | 'complete'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [generatedAssets, setGeneratedAssets] = useState<{name: string, data: string}[]>([]);
  
  // Progress State
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);

  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);
  
  // Asset Studio State (Manual)
  const [assetPrompt, setAssetPrompt] = useState('');
  const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<string | null>(null);

  // APK Export State
  const [showApkModal, setShowApkModal] = useState(false);
  const [apkStep, setApkStep] = useState<'init' | 'building' | 'ready'>('init');

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Default Engines per dimension
  const ENGINES_3D: GameEngine[] = ['threejs', 'babylonjs', 'aframe'];
  const ENGINES_2D: GameEngine[] = ['phaser', 'kaboom', 'canvas'];

  // Update dimension when prop changes
  useEffect(() => {
    setDimension(initialDimension);
  }, [initialDimension]);

  // Switch engine default when dimension changes
  useEffect(() => {
    if (dimension === '2d' && !ENGINES_2D.includes(engine)) {
      setEngine('phaser');
    } else if (dimension === '3d' && !ENGINES_3D.includes(engine)) {
      setEngine('threejs');
    }
  }, [dimension]);

  // Timer Logic
  useEffect(() => {
    let timer: number;
    if (buildState !== 'idle' && buildState !== 'complete') {
        timer = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) return 1;
                return prev - 1;
            });
            setProgress(prev => {
                if (prev >= 98) return 98;
                return prev + (100 / 20); // increment based on approx duration
            });
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [buildState]);

  // Auto-scroll logic for code
  useEffect(() => {
    if (viewMode === 'code' && codeContainerRef.current) {
        codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [generatedCode, viewMode]);

  // Auto-scroll logic for logs
  useEffect(() => {
    if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // --- Helper: Preserving Assets during edits ---
  const extractAndTokenizeAssets = (code: string) => {
      const legacyAssets = new Map<string, string>();
      let tokenizedCode = code;
      let counter = 0;

      tokenizedCode = tokenizedCode.replace(/(["'])(data:image\/[^;]+;base64,[^"']+)\1/g, (match, quote, data) => {
          const token = `[[LEGACY_ASSET_${counter++}]]`;
          legacyAssets.set(token, data);
          return `${quote}${token}${quote}`;
      });

      return { tokenizedCode, legacyAssets };
  };

  const restoreLegacyAssets = (code: string, legacyAssets: Map<string, string>) => {
      let restoredCode = code;
      legacyAssets.forEach((data, token) => {
          restoredCode = restoredCode.split(token).join(data);
      });
      return restoredCode;
  };

  const resolveNewAssets = (code: string, currentAssets: {name: string, data: string}[]) => {
      let resolved = code;
      currentAssets.forEach((asset, i) => {
          resolved = resolved.split(`[[ASSET_${i}]]`).join(asset.data);
      });
      return cleanCodeResponse(resolved);
  };

  // --- IMAGE PROCESSING UTILS (CLIENT SIDE) ---
  const processImageRemoveBg = async (base64: string, tolerance: number = 30): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = base64;
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if(!ctx) return resolve(base64);
              
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              
              // Sample top-left pixel
              const r0 = data[0];
              const g0 = data[1];
              const b0 = data[2];

              for(let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i+1];
                  const b = data[i+2];
                  
                  const diff = Math.sqrt((r-r0)**2 + (g-g0)**2 + (b-b0)**2);
                  if(diff < tolerance) {
                      data[i+3] = 0; // Set alpha to 0
                  }
              }
              ctx.putImageData(imageData, 0, 0);
              resolve(canvas.toDataURL('image/png'));
          };
      });
  };

  const processImageTrim = async (base64: string): Promise<string> => {
       return new Promise((resolve) => {
          const img = new Image();
          img.src = base64;
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if(!ctx) return resolve(base64);
              
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              
              // Scan for bounds
              let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
              for(let y=0; y<canvas.height; y++) {
                  for(let x=0; x<canvas.width; x++) {
                      const alpha = imageData.data[(y*canvas.width + x)*4 + 3];
                      if(alpha > 0) {
                          if(x < minX) minX = x;
                          if(x > maxX) maxX = x;
                          if(y < minY) minY = y;
                          if(y > maxY) maxY = y;
                      }
                  }
              }

              if(maxX < minX) return resolve(base64); // Empty image
              
              const trimWidth = maxX - minX + 1;
              const trimHeight = maxY - minY + 1;
              
              const trimmedCanvas = document.createElement('canvas');
              trimmedCanvas.width = trimWidth;
              trimmedCanvas.height = trimHeight;
              const trimmedCtx = trimmedCanvas.getContext('2d');
              
              if(trimmedCtx) {
                  trimmedCtx.drawImage(canvas, minX, minY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
                  resolve(trimmedCanvas.toDataURL('image/png'));
              } else {
                  resolve(base64);
              }
          };
      });
  };

  const handleApplyEffect = async (index: number, effect: 'removeBg' | 'trim') => {
      const asset = generatedAssets[index];
      addLog(`تطبيق تأثير ${effect === 'removeBg' ? 'إزالة الخلفية' : 'قص الحواف'} على ${asset.name}...`);
      
      let newData = asset.data;
      if(effect === 'removeBg') newData = await processImageRemoveBg(asset.data);
      if(effect === 'trim') newData = await processImageTrim(asset.data);
      
      const newAssets = [...generatedAssets];
      newAssets[index] = { ...asset, data: newData };
      setGeneratedAssets(newAssets);
      addLog(`تم تحديث ${asset.name}. يجب "تحديث" اللعبة لرؤية النتيجة.`);
  };


  const robustHandleGenerateGame = async () => {
      if (!prompt.trim() || buildState !== 'idle') return;

      const isEditing = !!generatedCode;
      
      // Reset State
      setBuildState('analyzing');
      setLogs([]); 
      setProgress(0);
      setTimeLeft(isEditing ? 15 : 30); 
      
      setViewMode('code');
      
      addLog(isEditing ? "تجهيز بيئة التعديل..." : `تهيئة محرك ${dimension.toUpperCase()}...`);
      addLog(`المحرك: ${engine.toUpperCase()} | النمط: ${dimension === '2d' ? 'Professional 2D' : 'Low Poly 3D'}`);

      try {
        await new Promise(r => setTimeout(r, 800));
        
        let localAssets = [...generatedAssets]; // Start with existing assets
        
        // 1. Prepare Code Context (If Editing)
        let codeContext = '';
        let legacyAssetsMap = new Map<string, string>();

        if (isEditing) {
            // Tokenize existing base64 to prevent AI from getting confused or wasting tokens
            const { tokenizedCode, legacyAssets } = extractAndTokenizeAssets(generatedCode);
            codeContext = tokenizedCode;
            legacyAssetsMap = legacyAssets;
            addLog(`تم حفظ ${legacyAssets.size} أصل بصري من الكود السابق.`);
        } else {
            // New Game: Reset assets
            setGeneratedCode('');
            setGeneratedAssets([]);
            localAssets = [];
        }

        // 2. Asset Analysis (ALWAYS run this, even if editing, to catch NEW requests)
        addLog(`تحليل المتطلبات البصرية...`);
        const neededAssets = await analyzeGameAssets(prompt, dimension);
        
        // Filter out assets we already have (fuzzy match by name)
        const newAssetsToGenerate = neededAssets.filter(newA => 
            !localAssets.some(existing => existing.name.toLowerCase().includes(newA.toLowerCase()))
        );

        if (newAssetsToGenerate.length > 0) {
            addLog(`تم تحديد ${newAssetsToGenerate.length} أصول جديدة...`);
            setBuildState('generating_assets');
            
            for (const assetName of newAssetsToGenerate) {
                addLog(`توليد: "${assetName}"...`);
                try {
                    let assetPromptFull = assetName;
                    if (dimension === '2d') {
                            assetPromptFull += ", 2d game sprite, isolated on white background, no shadow, clean edges, flat pixel art or vector style";
                    } else {
                            assetPromptFull += ", seamless texture, high quality material, flat lighting";
                    }

                    const b64 = await generateImage(assetPromptFull);
                    if (b64) {
                        localAssets.push({ name: assetName, data: b64 });
                        setGeneratedAssets(prev => [...prev, { name: assetName, data: b64 }]);
                        addLog(`✓ تم التجهيز: "${assetName}"`);
                    }
                } catch (e) {
                    addLog(`⚠ فشل: "${assetName}"`);
                }
            }
        } else {
            addLog("لا توجد أصول بصرية *جديدة* مطلوبة.");
        }

        // 3. Code Generation
        setBuildState('coding');
        addLog(isEditing ? "تطبيق التعديلات البرمجية..." : "كتابة منطق اللعبة...");
        
        const stream = await generateGameCodeStream(prompt, engine, extraLibs, localAssets, codeContext, dimension);
        let accumulatedCode = '';
        
        for await (const chunk of stream) {
            accumulatedCode += chunk;
            setGeneratedCode(accumulatedCode); // Visual feedback only
        }

        // 4. Restoration & Cleanup
        // First, clean Markdown
        let finalCode = cleanCodeResponse(accumulatedCode);
        
        // Second, restore the LEGACY assets (put the base64 back where the AI kept the tokens)
        if (isEditing) {
            finalCode = restoreLegacyAssets(finalCode, legacyAssetsMap);
        }

        // Third, resolve NEW assets (replace [[ASSET_i]] with base64)
        finalCode = resolveNewAssets(finalCode, localAssets);

        setGeneratedCode(finalCode);
        
        addLog("تم التجميع بنجاح.");
        setBuildState('complete');
        setProgress(100);
        setTimeLeft(0);
        setPrompt(''); 
        
        setTimeout(() => setViewMode('preview'), 1500);

      } catch (err: any) {
        console.error(err);
        addLog(`خطأ فادح: ${err.message}`);
        setBuildState('idle');
      }
  };

  const handleGenerateAsset = async () => {
    if (!assetPrompt.trim() || isGeneratingAsset) return;
    setIsGeneratingAsset(true);
    setGeneratedAsset(null);
    try {
        const typeSuffix = dimension === '2d' ? ", 2d sprite, isolated" : ", seamless texture";
        const result = await generateImage(assetPrompt + typeSuffix);
        if (result) setGeneratedAsset(result);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingAsset(false);
    }
  };
  
  const handleImportAsset = (asset: { name: string, data: string }) => {
     setGeneratedAssets(prev => [...prev, asset]);
     addLog(`تم استيراد ${asset.name} من المختبر.`);
     alert(`تم إضافة ${asset.name}! اطلب من المحرك استخدامه الآن.`);
  };

  const toggleLibrary = (lib: string) => {
      setExtraLibs(prev => prev.includes(lib) ? prev.filter(l => l !== lib) : [...prev, lib]);
  };

  const handleCopyAsset = () => {
      if(generatedAsset) {
          navigator.clipboard.writeText(generatedAsset);
          alert("تم نسخ!");
      }
  };

  const handleOpenApkExport = () => {
    setShowApkModal(true);
    setApkStep('building');
    setTimeout(() => {
        setApkStep('ready');
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Game Control Bar */}
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md z-20 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center flex-shrink-0">
         <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg border ${dimension === '2d' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
               {dimension === '2d' ? <Icons.Gamepad size={24} /> : <Icons.Box size={24} />}
            </div>
            
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                   {/* Dimension Toggle */}
                   <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                       <button 
                         onClick={() => setDimension('2d')} 
                         className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${dimension === '2d' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                       >
                         2D
                       </button>
                       <button 
                         onClick={() => setDimension('3d')} 
                         className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${dimension === '3d' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                       >
                         3D
                       </button>
                   </div>
                   <h2 className="font-bold text-white tracking-wide text-sm hidden sm:block">
                       {dimension === '2d' ? 'محرك 2D احترافي' : 'محرك 3D'}
                   </h2>
                </div>

                {/* Engine Selector */}
                <div className="flex items-center gap-1">
                   {(dimension === '2d' ? ENGINES_2D : ENGINES_3D).map((e) => (
                       <button 
                         key={e}
                         onClick={() => setEngine(e)}
                         className={`text-[9px] uppercase px-2 py-0.5 rounded border transition-all ${engine === e ? (dimension === '2d' ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-purple-600 border-purple-400 text-white') : 'bg-transparent border-white/10 text-slate-500 hover:text-slate-300'}`}
                       >
                           {e}
                       </button>
                   ))}
               </div>
            </div>
         </div>

         {/* Prompt Input */}
         <div className="flex-1 w-full xl:max-w-3xl flex gap-2">
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={generatedCode ? "اكتب التعديلات... (مثلاً: أضف عملة ذهبية، اجعل السرعة أكبر)" : (dimension === '2d' ? "وصف اللعبة 2D (مثلاً: لعبة منصات ماريو، سباق سيارات علوي)..." : "وصف اللعبة 3D (مثلاً: سباق سيارات، عالم مفتوح)...")}
              className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:ring-1 focus:ring-purple-500/50 outline-none text-white placeholder-slate-600 font-light text-sm text-right"
              dir="auto"
              onKeyDown={(e) => e.key === 'Enter' && robustHandleGenerateGame()}
              disabled={buildState !== 'idle' && buildState !== 'complete'}
            />
            <button
              onClick={robustHandleGenerateGame}
              disabled={buildState !== 'idle' && buildState !== 'complete' || !prompt.trim()}
              className={`px-6 py-2 text-white rounded-xl font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center gap-2 ${dimension === '2d' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-purple-600 hover:bg-purple-500'}`}
            >
               {(buildState !== 'idle' && buildState !== 'complete') ? <Icons.Cpu size={18} className="animate-spin" /> : <Icons.Play size={18} />}
               <span className="hidden sm:inline">{generatedCode ? 'تحديث' : 'بناء'}</span>
            </button>
         </div>
         
         <div className="flex gap-2">
             <button 
               onClick={() => setShowAssetsPanel(!showAssetsPanel)}
               className={`p-2.5 rounded-xl border transition-all ${showAssetsPanel ? 'bg-white/10 border-white/30 text-white' : 'bg-black/40 border-white/10 text-slate-500'}`}
               title="Texture Studio"
             >
                 {dimension === '3d' ? <Icons.Cube size={20} className="text-purple-400" /> : <Icons.Palette size={20} />}
             </button>
             <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                <button onClick={() => setViewMode('preview')} className={`p-2 rounded-lg transition-all ${viewMode === 'preview' ? 'bg-white/10 text-white' : 'text-slate-500'}`}><Icons.Monitor size={18} /></button>
                <button onClick={() => setViewMode('code')} className={`p-2 rounded-lg transition-all ${viewMode === 'code' ? 'bg-white/10 text-white' : 'text-slate-500'}`}><Icons.Code size={18} /></button>
             </div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative flex flex-col bg-[#0a0a0a] overflow-hidden">
             {buildState !== 'idle' && buildState !== 'complete' && viewMode === 'preview' ? (
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    <GlassyLoader 
                      text={buildState === 'analyzing' ? `تحديد الأصول المطلوبة (${dimension.toUpperCase()})...` : buildState === 'generating_assets' ? "توليد الرسومات..." : "كتابة منطق اللعبة..."} 
                      showSteps={true} 
                      progress={progress}
                    />
                    <div className="mt-2 text-cyan-400 font-mono text-sm tracking-widest animate-pulse">
                        الوقت المتبقي: {timeLeft} ثانية
                    </div>
                </div>
             ) : (buildState === 'idle' && !generatedCode) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 animate-fadeIn p-8 text-center">
                    <div className="relative mb-6">
                        <div className={`absolute inset-0 blur-3xl rounded-full ${dimension === '2d' ? 'bg-cyan-500/20' : 'bg-purple-600/20'}`}></div>
                        <div className={`relative z-10 p-4 rounded-3xl ${dimension === '2d' ? 'text-cyan-400 bg-cyan-500/10' : 'text-purple-400 bg-purple-500/10'}`}>
                           {dimension === '2d' ? <Icons.Gamepad size={64} /> : <Icons.Box size={64} />}
                        </div>
                    </div>
                    <h3 className="text-2xl font-light text-white mb-2">
                        {dimension === '2d' ? 'محرك الألعاب الاحترافي 2D' : 'محرك العالم ثلاثي الأبعاد 3D'}
                    </h3>
                    <p className="max-w-md mx-auto text-sm text-slate-500">
                        {dimension === '2d' 
                           ? 'استخدام محركات Phaser/Kaboom لبناء ألعاب احترافية مع فيزياء وتصادم وأنظمة جسيمات متقدمة.'
                           : 'بناء مجسمات حقيقية (Low Poly) وتلوينها بخامات مولدة بالذكاء الاصطناعي.'}
                    </p>
                </div>
             ) : (
                <>
                    {viewMode === 'preview' ? (
                        <div className="flex-1 relative bg-black overflow-hidden">
                            <iframe
                                title="Game Preview"
                                srcDoc={generatedCode}
                                className="w-full h-full border-none"
                                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                            />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button onClick={() => { const iframe = document.querySelector('iframe'); if(iframe) iframe.srcdoc = iframe.srcdoc; }} className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-md border border-white/10" title="إعادة التشغيل">
                                    <Icons.Loader size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-[#0e0e0e] overflow-hidden">
                            {/* Texture HUD */}
                            {(generatedAssets.length > 0) && (
                                <div className="h-48 bg-black/40 border-b border-white/5 p-4 flex gap-6 backdrop-blur-sm">
                                     <div className="flex-1 flex flex-col">
                                         <h4 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-2 uppercase tracking-widest">
                                             <Icons.Cpu size={14} className={buildState !== 'complete' ? "animate-spin" : ""} /> سجلات البناء
                                         </h4>
                                         <div className="flex-1 bg-black/50 rounded-lg border border-cyan-500/20 p-2 font-mono text-[10px] text-green-500 overflow-y-auto custom-scrollbar shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" ref={logsContainerRef}>
                                             {logs.map((log, i) => <div key={i} className="whitespace-nowrap">{log}</div>)}
                                         </div>
                                     </div>
                                     <div className="w-1/3 flex flex-col">
                                         <h4 className={`text-xs font-bold mb-2 uppercase tracking-widest flex items-center justify-between ${dimension === '2d' ? 'text-cyan-400' : 'text-purple-400'}`}>
                                            <span>Active Assets</span>
                                         </h4>
                                         <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar p-1">
                                             {generatedAssets.map((asset, i) => (
                                                 <div key={i} className={`min-w-[100px] h-full rounded border overflow-hidden relative group animate-fadeIn bg-black/60 ${dimension === '2d' ? 'border-cyan-500/30' : 'border-purple-500/30'}`}>
                                                     <img src={asset.data} alt={asset.name} className={`w-full h-full ${dimension === '2d' ? 'object-contain p-2' : 'object-cover'}`} />
                                                     
                                                     {/* Quick Actions Hover */}
                                                     <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                                         {dimension === '2d' && (
                                                             <>
                                                                <button onClick={() => handleApplyEffect(i, 'removeBg')} className="px-2 py-1 bg-white/10 hover:bg-white/30 text-[8px] rounded text-white border border-white/20">Remove BG</button>
                                                                <button onClick={() => handleApplyEffect(i, 'trim')} className="px-2 py-1 bg-white/10 hover:bg-white/30 text-[8px] rounded text-white border border-white/20">Trim</button>
                                                             </>
                                                         )}
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                </div>
                            )}
                            
                            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={codeContainerRef}>
                                <SyntaxHighlighter
                                    language="html"
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, padding: '1.5rem', minHeight: '100%', fontSize: '13px', background: 'transparent' }}
                                    showLineNumbers
                                    wrapLines
                                >
                                    {generatedCode || '<!-- جاري التهيئة... -->'}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    )}
                </>
             )}
          </div>

          {showAssetsPanel && (
              <div className="w-80 border-l border-white/5 bg-black/80 backdrop-blur-xl flex flex-col animate-slideLeft z-30 shadow-2xl absolute right-0 inset-y-0 h-full">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                          {dimension === '3d' ? (
                             <>
                                <Icons.Cube size={16} className="text-purple-500" /> مختبر 3D
                             </>
                          ) : (
                             <>
                                <Icons.Palette size={16} className="text-pink-500" /> استوديو الأصول
                             </>
                          )}
                      </h3>
                      <button onClick={() => setShowAssetsPanel(false)} className="text-slate-500 hover:text-white"><Icons.Close size={16} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {dimension === '3d' ? (
                          <div className="p-4">
                              <ThreeDAssetGen isEmbedded onAssetGenerated={handleImportAsset} />
                          </div>
                      ) : (
                          <div className="p-4">
                              {/* Manual Generation */}
                              <div className="mb-6">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">توليد أصل جديد</label>
                                  <textarea 
                                     value={assetPrompt}
                                     onChange={(e) => setAssetPrompt(e.target.value)}
                                     className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500/50 resize-none mb-2 text-right"
                                     placeholder={dimension === '2d' ? "مثلاً: طائر أزرق صغير بكسل ارت..." : "مثلاً: خامة جدار حجري..."}
                                     dir="auto"
                                  />
                                  <button 
                                     onClick={handleGenerateAsset}
                                     disabled={isGeneratingAsset || !assetPrompt.trim()}
                                     className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold shadow-[0_0_10px_rgba(219,39,119,0.3)] disabled:opacity-50 flex justify-center items-center gap-2"
                                  >
                                      {isGeneratingAsset ? <Icons.Loader size={14} className="animate-spin" /> : <Icons.Sparkles size={14} />}
                                      توليد
                                  </button>
                              </div>

                              {/* Generated Asset Preview with Tools */}
                              {generatedAsset && (
                                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 animate-fadeIn mb-6">
                                      <div className="aspect-square w-full rounded-lg overflow-hidden mb-3 border border-white/10 relative group bg-black/40">
                                          <img src={generatedAsset} alt="Asset" className="w-full h-full object-contain" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                          {dimension === '2d' && (
                                             <>
                                                <button onClick={async () => setGeneratedAsset(await processImageRemoveBg(generatedAsset!))} className="py-1 bg-white/10 hover:bg-white/20 text-xs rounded border border-white/10">Magic Eraser</button>
                                                <button onClick={async () => setGeneratedAsset(await processImageTrim(generatedAsset!))} className="py-1 bg-white/10 hover:bg-white/20 text-xs rounded border border-white/10">Trim</button>
                                             </>
                                          )}
                                      </div>
                                      <button 
                                         onClick={handleCopyAsset}
                                         className="w-full py-2 bg-white/10 hover:bg-white/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-mono flex items-center justify-center gap-2"
                                      >
                                          <Icons.Link size={14} /> نسخ البيانات
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                      
                      {/* List of Game Assets for Quick Edit */}
                      {generatedAssets.length > 0 && (
                          <div className="p-4 border-t border-white/5">
                             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">أصول اللعبة الحالية</label>
                             <div className="flex flex-col gap-2">
                                {generatedAssets.map((asset, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                                        <img src={asset.data} className="w-8 h-8 object-contain bg-black/50 rounded" />
                                        <span className="text-xs text-slate-300 flex-1 truncate">{asset.name}</span>
                                        {dimension === '2d' && (
                                            <div className="flex gap-1">
                                                <button onClick={() => handleApplyEffect(i, 'removeBg')} className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-white" title="Remove BG"><Icons.Sparkles size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};