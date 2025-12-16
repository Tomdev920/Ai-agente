import React, { useState, useEffect, useRef } from 'react';
import { generateImage } from '../services/gemini';
import { Icons } from './Icon';
import { GlassyLoader } from './GlassyLoader';
import { 
  Scene, 
  WebGLRenderer, 
  PerspectiveCamera, 
  AmbientLight, 
  DirectionalLight, 
  TextureLoader, 
  BoxGeometry, 
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial, 
  Mesh, 
  SRGBColorSpace, 
  RepeatWrapping,
  DoubleSide
} from 'three';

interface ThreeDAssetGenProps {
  isEmbedded?: boolean;
  onAssetGenerated?: (asset: { name: string; data: string; type: string }) => void;
}

type AssetType = 'texture' | 'character' | 'skybox';
type AssetStyle = 'realistic' | 'lowpoly' | 'handpainted' | 'cyberpunk';

export const ThreeDAssetGen: React.FC<ThreeDAssetGenProps> = ({ isEmbedded = false, onAssetGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('character');
  const [style, setStyle] = useState<AssetStyle>('realistic');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing3D, setIsProcessing3D] = useState(false);
  const [generatedName, setGeneratedName] = useState('');
  
  const [rawSheet, setRawSheet] = useState<string | null>(null);
  const [textureData, setTextureData] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  
  // --- 3D Scene Refs ---
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const requestRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // --- Initialize 3D Scene ---
  useEffect(() => {
    if (!mountRef.current || !textureData) return;

    // Cleanup previous
    if (rendererRef.current) {
        mountRef.current.innerHTML = '';
        rendererRef.current.dispose();
    }

    // 1. Scene Setup
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    const scene = new Scene();
    sceneRef.current = scene;
    
    const renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new PerspectiveCamera(45, w / h, 0.1, 100);
    cameraRef.current = camera;

    // 2. Lighting
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const dirLight = new DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    
    const backLight = new DirectionalLight(0x00ffff, 0.5); // Rim light
    backLight.position.set(-5, 2, -5);
    scene.add(backLight);

    // 3. Create Mesh based on Type
    const loader = new TextureLoader();
    const texture = loader.load(textureData);
    texture.colorSpace = SRGBColorSpace;
    
    let geometry;
    let material;
    
    if (assetType === 'character') {
        // Use a Cylinder/Capsule approximation for characters
        geometry = new CylinderGeometry(0.5, 0.5, 1.8, 32);
        // Map texture to cylinder surface
        material = new MeshStandardMaterial({ 
            map: texture, 
            roughness: 0.4,
            metalness: 0.1 
        });
        camera.position.set(0, 0, 4);
    } else if (assetType === 'skybox') {
        // Sphere for environment (Inside view)
        geometry = new SphereGeometry(10, 60, 40);
        geometry.scale(-1, 1, 1); // Invert to see inside
        material = new MeshStandardMaterial({ 
            map: texture, 
            side: DoubleSide,
            emissive: 0xffffff,
            emissiveMap: texture,
            emissiveIntensity: 0.5
        });
        camera.position.set(0, 0, 0.1); // Inside center
        // Auto rotate camera for skybox
    } else {
        // Box for Texture/Material
        geometry = new BoxGeometry(1.5, 1.5, 1.5);
        material = new MeshStandardMaterial({ 
            map: texture,
            roughness: 0.7,
            metalness: 0.2
        });
        camera.position.set(0, 0, 3.5);
    }

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // 4. Animation Loop
    const animate = () => {
        requestRef.current = requestAnimationFrame(animate);
        
        if (assetType === 'skybox') {
             // Auto rotate camera for skybox view
             if (!isDragging.current && meshRef.current) {
                 meshRef.current.rotation.y += 0.001;
             }
        } else {
            // Auto rotate object for others
            if (!isDragging.current && meshRef.current) {
                 meshRef.current.rotation.y += 0.005;
            }
        }
        
        renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
        if (rendererRef.current) rendererRef.current.dispose();
        geometry.dispose();
    };
  }, [textureData, assetType]);


  // --- Mouse Controls ---
  const handleMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || !meshRef.current) return;
      const deltaMove = { x: e.clientX - previousMousePosition.current.x, y: e.clientY - previousMousePosition.current.y };
      const rotationSpeed = 0.005;
      
      if (assetType === 'skybox') {
          // Rotate mesh inverse for skybox feel
          meshRef.current.rotation.y -= deltaMove.x * rotationSpeed;
          meshRef.current.rotation.x -= deltaMove.y * rotationSpeed;
      } else {
          meshRef.current.rotation.y += deltaMove.x * rotationSpeed;
          meshRef.current.rotation.x += deltaMove.y * rotationSpeed;
      }
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => isDragging.current = false;


  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setRawSheet(null);
    setTextureData(null);
    setIsProcessing3D(false);

    let fullPrompt = "";
    const baseName = prompt.split(' ').slice(0, 3).join('_');

    if (assetType === 'character') {
        // Generate a texture meant to be wrapped around a cylinder
        fullPrompt = `front view game character skin texture of ${prompt}, ${style} style, symmetrical, flat projection, uv map layout, isolated on white background`;
    } else if (assetType === 'texture') {
        fullPrompt = `seamless texture of ${prompt}, ${style} style, flat lighting, high detailed, 4k`;
    } else {
        fullPrompt = `equirectangular 360 panorama skybox of ${prompt}, ${style} style, hdri`;
    }

    try {
        const result = await generateImage(fullPrompt);
        if (result) {
            setGeneratedName(baseName);
            setRawSheet(result);
            setIsProcessing3D(true);
            
            // Just simulate processing time for effect
            setTimeout(() => {
                setTextureData(result);
                setIsProcessing3D(false);
            }, 800);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleImport = () => {
      if (rawSheet && onAssetGenerated) {
          onAssetGenerated({ name: generatedName || 'asset', data: rawSheet, type: assetType });
          if(isEmbedded) setPrompt(''); 
      }
  };

  const handleDownload = () => {
      if (rawSheet) {
          const link = document.createElement('a');
          link.href = rawSheet;
          link.download = `3D_ASSET_${assetType}_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  return (
    <div className={`flex flex-col h-full ${isEmbedded ? 'p-0' : 'p-4 sm:p-8 max-w-6xl mx-auto'}`}>
       {!isEmbedded && (
           <div className="mb-8 text-center animate-fadeIn">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 tracking-wide neon-text">
                   مختبر المجسمات
                </h2>
                <p className="text-slate-400 text-sm font-light">توليد مجسمات هندسية ومعاينتها في فضاء ثلاثي الأبعاد</p>
           </div>
       )}

       <div className={`flex flex-col ${isEmbedded ? 'gap-4' : 'lg:flex-row gap-6 glass-panel rounded-3xl overflow-hidden shadow-2xl min-h-[500px]'}`}>
           
           {/* Controls Section */}
           <div className={`${isEmbedded ? 'w-full' : 'flex-1 p-6 lg:p-8 bg-black/20 border-b lg:border-r lg:border-b-0 border-white/5'} flex flex-col gap-6`}>
               <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">نوع المجسم (Geometry)</label>
                   <div className="grid grid-cols-3 gap-2">
                       {[
                           { id: 'character', icon: Icons.User, label: 'شخصية (Cylinder)' },
                           { id: 'texture', icon: Icons.Box, label: 'مكعب (Box)' },
                           { id: 'skybox', icon: Icons.Globe, label: 'عالم (Sphere)' },
                       ].map((t) => (
                           <button
                             key={t.id}
                             onClick={() => setAssetType(t.id as AssetType)}
                             className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${assetType === t.id ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
                           >
                               {React.createElement(t.icon, { size: isEmbedded ? 16 : 20 })}
                               <span className="text-[10px] font-bold">{t.label}</span>
                           </button>
                       ))}
                   </div>
               </div>

               {/* Style Selector */}
               <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">النمط (Style)</label>
                   <div className="flex flex-wrap gap-2">
                       {['realistic', 'lowpoly', 'handpainted', 'cyberpunk'].map((s) => (
                           <button key={s} onClick={() => setStyle(s as AssetStyle)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${style === s ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'}`}>
                               {s}
                           </button>
                       ))}
                   </div>
               </div>

               <div className="flex-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">الوصف</label>
                   <textarea 
                     value={prompt} onChange={(e) => setPrompt(e.target.value)}
                     className={`w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/50 resize-none text-right ${isEmbedded ? 'h-24 text-xs' : 'h-32 text-sm'}`}
                     placeholder={assetType === 'character' ? "محارب فضائي..." : assetType === 'texture' ? "صندوق خشبي..." : "الفضاء الخارجي..."}
                     dir="auto"
                   />
               </div>

               <button
                  onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isGenerating || !prompt.trim() ? 'bg-white/5 text-slate-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'}`}
               >
                   {isGenerating ? <Icons.Loader size={18} className="animate-spin" /> : <Icons.Cube size={18} />}
                   <span>{isGenerating ? 'جاري المعالجة...' : 'توليد المجسم 3D'}</span>
               </button>
           </div>

           {/* Preview Section */}
           {(!isEmbedded || rawSheet) && (
               <div className={`${isEmbedded ? 'mt-4 border-t border-white/5 pt-4' : 'flex-1 bg-black/40 p-0 lg:p-0 flex items-center justify-center relative'} overflow-hidden relative`}>
                   
                   {isGenerating || isProcessing3D ? (
                       <GlassyLoader text={isProcessing3D ? "إكساء المجسم..." : "تحليل الهندسة..."} size={isEmbedded ? "sm" : "lg"} />
                   ) : textureData ? (
                       <div className="w-full h-full flex flex-col relative">
                           <div 
                              ref={mountRef} 
                              className="w-full h-full min-h-[400px] cursor-move bg-gradient-to-b from-[#111] to-[#050505]"
                              onMouseDown={handleMouseDown}
                              onMouseMove={handleMouseMove}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseUp}
                           ></div>
                           <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-10">
                               <span className="px-3 py-1 bg-black/50 rounded-full text-[10px] text-cyan-400 font-mono backdrop-blur-md border border-white/10 flex items-center gap-2 w-fit mx-auto animate-pulse">
                                   <Icons.Box size={12} /> معاينة حية للمجسم (اسحب للتدوير)
                               </span>
                           </div>
                           <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                               {isEmbedded ? (
                                   <button onClick={handleImport} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-md">
                                       <Icons.Check size={14} /> استيراد
                                   </button>
                               ) : (
                                   <button onClick={handleDownload} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-white/10 backdrop-blur-md">
                                       <Icons.Download size={14} /> حفظ الخامة
                                   </button>
                               )}
                           </div>
                       </div>
                   ) : (
                       !isEmbedded && (
                           <div className="text-center text-slate-600 p-8">
                               <div className="relative w-24 h-24 mx-auto mb-4">
                                   <div className="absolute inset-0 border-2 border-dashed border-slate-700 rounded-full animate-spin-slow"></div>
                                   <div className="absolute inset-0 flex items-center justify-center">
                                       <Icons.Cube size={32} className="opacity-50" />
                                   </div>
                               </div>
                               <p className="text-sm font-mono uppercase tracking-widest">منصة العرض ثلاثية الأبعاد</p>
                           </div>
                       )
                   )}
               </div>
           )}
       </div>
    </div>
  );
};