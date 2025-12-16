import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icon';
import { createChatSession, sendMessageStream } from '../services/gemini';
import { ModelType } from '../types';
import { GenerateContentResponse } from "@google/genai";
import { 
    Scene, 
    WebGLRenderer, 
    PerspectiveCamera, 
    AmbientLight, 
    PointLight, 
    DirectionalLight,
    SphereGeometry, 
    MeshStandardMaterial, 
    Mesh, 
    Color,
    Group,
    BoxGeometry,
    CylinderGeometry,
    MathUtils
} from 'three';

export const VoiceAvatar: React.FC = () => {
  // --- UI State ---
  const [isActive, setIsActive] = useState(false); 
  const [status, setStatus] = useState('جاهز'); 
  const [userText, setUserText] = useState(''); 
  const [aiText, setAiText] = useState(''); 
  
  // --- Visual State ---
  const [isListening, setIsListening] = useState(false); 
  const [isSpeaking, setIsSpeaking] = useState(false); 

  // --- Refs for Logic ---
  const isActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false); 
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const chatSessionRef = useRef<any>(null);
  const retryTimeoutRef = useRef<any>(null);
  
  // --- 3D Engine Refs ---
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const headGroupRef = useRef<Group | null>(null);
  const jawRef = useRef<Group | null>(null);
  const eyesRef = useRef<Group | null>(null);
  const requestRef = useRef<number | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  // Sync Refs
  useEffect(() => {
    isActiveRef.current = isActive;
    isSpeakingRef.current = isSpeaking;
  }, [isActive, isSpeaking]);

  // --- 1. Initialize AI ---
  useEffect(() => {
    try {
      chatSessionRef.current = createChatSession(ModelType.FLASH, "You are TOMA-9000, a highly intelligent robot assistant. You speak Arabic. Reply in Arabic. Keep your answers concise, helpful and friendly. Do not use markdown symbols like * or # in the output, just plain text.");
    } catch (e) {
      console.error("Gemini Init Error", e);
      setStatus("خطأ في الاتصال");
    }
  }, []);

  // --- 2. Initialize 3D Scene ---
  useEffect(() => {
    if (!mountRef.current) return;

    if (rendererRef.current) {
        try { rendererRef.current.dispose(); } catch(e) {}
        const canvas = mountRef.current.querySelector('canvas');
        if (canvas) mountRef.current.removeChild(canvas);
    }

    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    const scene = new Scene();
    scene.background = new Color(0x050505);

    const camera = new PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 14);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    sceneRef.current = scene;

    // Lights
    scene.add(new AmbientLight(0xffffff, 0.4));
    const dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(0, 5, 5);
    scene.add(dirLight);
    const blueLight = new PointLight(0x00ffff, 2, 50);
    blueLight.position.set(5, 2, 5);
    scene.add(blueLight);
    const redLight = new PointLight(0xff0044, 2, 50);
    redLight.position.set(-5, -2, 5);
    scene.add(redLight);

    // Robot Geometry
    const robotGroup = new Group();
    headGroupRef.current = robotGroup;
    scene.add(robotGroup);

    const armorMat = new MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
    const skinMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.5 });
    const eyeMat = new MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 });

    const head = new Mesh(new SphereGeometry(2.5, 32, 32), armorMat);
    head.scale.set(1, 1.2, 1.1);
    robotGroup.add(head);

    const eyesGroup = new Group();
    eyesGroup.position.set(0, 0.2, 2.2);
    robotGroup.add(eyesGroup);
    eyesRef.current = eyesGroup;

    const visor = new Mesh(new BoxGeometry(3, 0.8, 0.5), skinMat);
    eyesGroup.add(visor);

    const leftEye = new Mesh(new SphereGeometry(0.25, 16, 16), eyeMat);
    leftEye.position.set(-0.8, 0, 0.3);
    leftEye.scale.set(1, 0.5, 0.2);
    eyesGroup.add(leftEye);

    const rightEye = new Mesh(new SphereGeometry(0.25, 16, 16), eyeMat);
    rightEye.position.set(0.8, 0, 0.3);
    rightEye.scale.set(1, 0.5, 0.2);
    eyesGroup.add(rightEye);

    const jawGroup = new Group();
    jawGroup.position.set(0, -0.5, 0.5);
    robotGroup.add(jawGroup);
    jawRef.current = jawGroup;

    const jawMesh = new Mesh(new BoxGeometry(2, 1.5, 2), armorMat);
    jawMesh.position.set(0, -1, 0); 
    jawMesh.scale.set(1, 1, 1.2);
    jawGroup.add(jawMesh);

    const neck = new Mesh(new CylinderGeometry(0.8, 1.2, 2, 16), skinMat);
    neck.position.y = -3.5;
    robotGroup.add(neck);

    // Animation Loop
    let time = 0;
    let blinkTimer = 3;

    const animate = () => {
        requestRef.current = requestAnimationFrame(animate);
        time += 0.05;

        if (headGroupRef.current) {
            const targetX = mousePos.current.x * 0.3;
            const targetY = mousePos.current.y * 0.3;
            headGroupRef.current.rotation.y = MathUtils.lerp(headGroupRef.current.rotation.y, targetX, 0.1);
            headGroupRef.current.rotation.x = MathUtils.lerp(headGroupRef.current.rotation.x, targetY, 0.1);
            headGroupRef.current.position.y = Math.sin(time * 0.05) * 0.1;
        }

        if (jawRef.current) {
            if (isSpeakingRef.current) {
                const talk = (Math.sin(time * 15) + 1) * 0.15;
                jawRef.current.rotation.x = MathUtils.lerp(jawRef.current.rotation.x, talk, 0.4);
            } else {
                jawRef.current.rotation.x = MathUtils.lerp(jawRef.current.rotation.x, 0, 0.1);
            }
        }

        if (eyesRef.current) {
            blinkTimer -= 0.01;
            if (blinkTimer <= 0) {
                eyesRef.current.scale.y = 0.1;
                if (blinkTimer <= -0.15) blinkTimer = Math.random() * 4 + 2;
            } else {
                eyesRef.current.scale.y = MathUtils.lerp(eyesRef.current.scale.y, 1, 0.4);
            }
        }
        renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
        if (mountRef.current && cameraRef.current && rendererRef.current) {
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            cameraRef.current.aspect = w/h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        }
    };
    window.addEventListener('resize', onResize);

    const onMouseMove = (e: MouseEvent) => {
        mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  // --- 3. Robust Speech Logic ---

  const startConversation = () => {
      if (!isActive) {
          setIsActive(true);
          startListeningPhase();
      } else {
          stopConversation();
      }
  };

  const stopConversation = () => {
      setIsActive(false);
      setIsListening(false);
      setIsSpeaking(false);
      isProcessingRef.current = false;
      setStatus("تم الإيقاف");
      
      // Force Stop Everything
      if (recognitionRef.current) {
         try { recognitionRef.current.abort(); } catch(e) {}
         recognitionRef.current = null;
      }
      if (synthRef.current) {
          synthRef.current.cancel();
      }
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  };

  const startListeningPhase = () => {
      if (!isActiveRef.current) return;

      // 1. Ensure TTS is stopped
      synthRef.current.cancel();
      setIsSpeaking(false);
      
      // 2. Clear flags
      isProcessingRef.current = false;

      // 3. Browser Check
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) {
          setStatus("المتصفح لا يدعم الصوت");
          return;
      }

      // 4. Initialize Recognition
      if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.interimResults = true;
      recognition.continuous = false; 
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
          if (!isActiveRef.current) {
              recognition.abort();
              return;
          }
          setIsListening(true);
          setUserText(''); // Clear old text to show "..."
          setStatus("أستمع إليك...");
      };

      recognition.onresult = (event: any) => {
          if (!isActiveRef.current) return;

          let transcript = '';
          // Concatenate all results to be sure we don't miss anything
          for (let i = 0; i < event.results.length; ++i) {
             transcript += event.results[i][0].transcript;
          }

          // Force update UI
          if (transcript) {
              setUserText(transcript);
          }

          // Check for finality
          if (event.results[event.results.length - 1].isFinal) {
             // Stop listening
             setIsListening(false);
             isProcessingRef.current = true;
             setStatus("أفكر...");
             try { recognition.stop(); } catch(e) {}
             
             // Process
             processAIResponse(transcript);
          }
      };

      recognition.onerror = (event: any) => {
          if (!isActiveRef.current) return;
          console.log("Speech Error:", event.error);
          setIsListening(false);

          // Handle specific errors
          if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
              if (!isProcessingRef.current && !isSpeakingRef.current) {
                  triggerRetry();
              }
          } else if (event.error === 'not-allowed') {
              setStatus("يرجى تفعيل الميكروفون");
              setIsActive(false);
          } else {
              triggerRetry();
          }
      };

      recognition.onend = () => {
          setIsListening(false);
          if (isActiveRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
              triggerRetry();
          }
      };

      try {
          recognitionRef.current = recognition;
          recognition.start();
      } catch (e) {
          console.error("Start Error:", e);
          triggerRetry();
      }
  };

  const triggerRetry = () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
              startListeningPhase();
          }
      }, 200);
  };

  const processAIResponse = async (text: string) => {
      if (!chatSessionRef.current) return;
      if (!text.trim()) {
           // If empty text came through as final, just retry
           isProcessingRef.current = false;
           triggerRetry();
           return;
      }

      try {
          const stream = await sendMessageStream(chatSessionRef.current, text);
          let fullText = '';
          for await (const chunk of stream) {
              const t = (chunk as GenerateContentResponse).text;
              if (t) fullText += t;
          }
          setAiText(fullText);
          speakResponse(fullText);
      } catch (e) {
          console.error(e);
          setStatus("خطأ في المعالجة");
          isProcessingRef.current = false;
          triggerRetry();
      }
  };

  const speakResponse = (text: string) => {
      if (!text || !isActiveRef.current) {
          isProcessingRef.current = false;
          triggerRetry();
          return;
      }

      setStatus("أتحدث...");
      setIsSpeaking(true);
      
      if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e) {}
      }

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = 1.0; 
      
      const voices = synthRef.current.getVoices();
      const arVoice = voices.find(v => v.lang.includes('ar'));
      if (arVoice) u.voice = arVoice;

      u.onend = () => {
          setIsSpeaking(false);
          isProcessingRef.current = false;
          if (isActiveRef.current) {
              setStatus("أستمع إليك...");
              triggerRetry();
          } else {
              setStatus("جاهز");
          }
      };

      u.onerror = (e) => {
          console.error("TTS Error", e);
          setIsSpeaking(false);
          isProcessingRef.current = false;
          if (isActiveRef.current) triggerRetry();
      };

      synthRef.current.speak(u);
  };

  return (
    <div className="flex flex-col h-full bg-black relative overflow-hidden font-sans">
        {/* 3D Scene Layer */}
        <div ref={mountRef} className="absolute inset-0 z-0"></div>

        {/* HUD Layer */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-6 pointer-events-none">
            
            {/* Header Status */}
            <div className="flex justify-between items-start animate-fadeIn">
                <div className="glass-panel p-3 rounded-2xl flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isActive ? (isListening ? 'bg-red-500 animate-pulse' : 'bg-green-500') : 'bg-slate-500'}`}></div>
                    <div>
                        <h2 className="text-sm font-bold text-white">TOMA-9000</h2>
                        <p className="text-[10px] text-slate-400 font-mono">{status}</p>
                    </div>
                </div>
            </div>

            {/* Chat Bubbles */}
            <div className="flex-1 flex flex-col justify-end gap-4 mb-28 px-2 overflow-y-auto custom-scrollbar max-h-[60vh]">
                {aiText && (
                    <div className={`self-start max-w-[85%] animate-slideUp pointer-events-auto transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-70'}`}>
                        <div className="flex items-end gap-2">
                             <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                                 <Icons.Cpu size={16} />
                             </div>
                             <div className="bg-black/80 border border-cyan-500/30 p-4 rounded-2xl rounded-bl-none shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                                 <p className="text-cyan-100 text-sm leading-relaxed">{aiText}</p>
                             </div>
                        </div>
                    </div>
                )}
                {(userText || isListening) && (
                    <div className="self-end max-w-[85%] animate-fadeIn pointer-events-auto">
                         <div className="flex flex-row-reverse items-end gap-2">
                             <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                                 <Icons.User size={16} />
                             </div>
                             <div className="bg-white/10 border border-white/10 p-4 rounded-2xl rounded-br-none backdrop-blur-md">
                                 <p className="text-white text-sm">
                                    {userText || <span className="animate-pulse opacity-50 font-mono tracking-widest">...</span>}
                                 </p>
                             </div>
                         </div>
                    </div>
                )}
            </div>

            {/* Main Control Button */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-auto z-20">
                <button
                    onClick={startConversation}
                    className={`
                        relative w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all duration-300
                        shadow-[0_0_40px_rgba(0,0,0,0.6)] group
                        ${isActive 
                            ? (isListening ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-cyan-600 border-cyan-400') 
                            : 'bg-white/10 border-white/20 hover:bg-cyan-600 hover:border-cyan-400'}
                    `}
                >
                    {isActive && <div className="absolute inset-0 rounded-full border-2 border-white opacity-20 animate-ping"></div>}
                    
                    {isActive ? (
                        isListening ? <Icons.Mic size={40} className="text-white" /> : <Icons.Cpu size={40} className="text-white animate-spin-slow" />
                    ) : (
                        <Icons.Play size={40} className="text-slate-300 group-hover:text-white pl-1" />
                    )}
                </button>
            </div>
            
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                 <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                     {isActive ? (isListening ? "استمع..." : isSpeaking ? "أتحدث..." : "معالجة...") : "اضغط للبدء"}
                 </p>
            </div>
        </div>
    </div>
  );
};