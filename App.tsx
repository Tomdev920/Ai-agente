import React, { useState, useEffect, useRef } from 'react';
import { GenerateContentResponse, Chat } from "@google/genai";
import { createChatSession, sendMessageStream } from './services/gemini';
import { Message, Role, ModelType } from './types';
import { Icons } from './components/Icon';
import { ChatMessage } from './components/ChatMessage';
import { ModelSelector } from './components/ModelSelector';
import { ImageGenerator } from './components/ImageGenerator';
import { WebsiteBuilder } from './components/WebsiteBuilder';
import { WebsiteBuilderPro } from './components/WebsiteBuilderPro';
import { GameBuilder } from './components/GameBuilder';
import { ThreeDAssetGen } from './components/ThreeDAssetGen';
import { VoiceAvatar } from './components/VoiceAvatar';
import { VideoGenerator } from './components/VideoGenerator';
import { FlutterBuilder } from './components/FlutterBuilder';
import { VideoToCode } from './components/VideoToCode';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type ViewMode = 'chat' | 'code' | 'image' | 'video' | 'website' | 'website_pro' | 'game' | 'game2d' | 'model3d' | 'voice_face' | 'flutter' | 'video_to_code';

// Enhanced Attachment Interface
export interface Attachment {
  name: string;
  data: string; // Base64 or Text Content
  mimeType: string;
  type: 'image' | 'video' | 'pdf' | 'text' | 'zip' | 'code';
  size?: number;
}

function App() {
  const [activeView, setActiveView] = useState<ViewMode>('chat');
  
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [codeMessages, setCodeMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelType, setModelType] = useState<ModelType>(ModelType.FLASH);
  
  // Default to true for desktop experience
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // To capture full chat for PDF
  
  // Session Refs
  const chatSessionRef = useRef<Chat | null>(null);
  const codeSessionRef = useRef<Chat | null>(null);

  const getCurrentMessages = () => activeView === 'code' ? codeMessages : chatMessages;
  const setCurrentMessages = (action: React.SetStateAction<Message[]>) => {
    if (activeView === 'code') setCodeMessages(action);
    else setChatMessages(action);
  };

  useEffect(() => {
    // Auto-close on mobile initially
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    
    if (!chatSessionRef.current) {
      chatSessionRef.current = createChatSession(ModelType.FLASH);
    }
    if (!codeSessionRef.current) {
      const codingInstruction = "You are Toma Ai, an expert Senior Software Engineer and Coding Assistant developed by Tamer Mohamed Saleh (تامر محمد صالح). You are chatting with an Arabic speaking user. Provide high-quality, efficient, and secure code. Explain complex concepts simply. Always assume the user wants the latest stable versions of libraries. Reply in Arabic mostly, but keep technical terms in English where appropriate.";
      codeSessionRef.current = createChatSession(ModelType.PRO, codingInstruction);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'code') {
      setModelType(ModelType.PRO);
    } else if (activeView === 'chat') {
      setModelType(ModelType.FLASH);
    }
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [activeView]);

  useEffect(() => {
    // Re-create chat session if model changes manually in chat view
    if (activeView === 'chat' && chatSessionRef.current) {
       chatSessionRef.current = createChatSession(modelType);
    }
  }, [modelType, activeView]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, codeMessages, activeView]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // --- UNIVERSAL FILE HANDLER ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      
      for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isPDF = file.type === 'application/pdf';
        const isZip = file.type === 'application/zip' || file.name.endsWith('.zip');
        const isText = file.type.startsWith('text/') || 
                       file.name.match(/\.(js|ts|tsx|jsx|json|html|css|py|md|txt|xml|c|cpp|java)$/i);

        if (isImage || isVideo || isPDF) {
            // Read as Base64 for Gemini InlineData
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                setAttachments(prev => [...prev, {
                  name: file.name,
                  data: ev.target!.result as string,
                  mimeType: file.type,
                  type: isImage ? 'image' : isVideo ? 'video' : 'pdf',
                  size: file.size
                }]);
              }
            };
            reader.readAsDataURL(file);

        } else if (isZip) {
            // Extract ZIP Content Client-Side for Analysis
            try {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(file);
                let extractedText = `[ARCHIVE_CONTENT: ${file.name}]\n`;
                
                let fileCount = 0;
                for (const [path, fileEntry] of Object.entries(zipContent.files)) {
                    const entry: any = fileEntry;
                    if (fileCount > 50) break; // Limit file count
                    if (!entry.dir) {
                        // Check if looks like text
                        if (path.match(/\.(js|ts|tsx|jsx|json|html|css|py|md|txt|xml|c|cpp|java|config|yml)$/i)) {
                             const content = await entry.async('string');
                             extractedText += `\n--- START FILE: ${path} ---\n${content}\n--- END FILE ---\n`;
                             fileCount++;
                        }
                    }
                }
                
                setAttachments(prev => [...prev, {
                    name: file.name,
                    data: extractedText,
                    mimeType: 'application/zip',
                    type: 'zip',
                    size: file.size
                }]);

            } catch (err) {
                console.error("Failed to read zip", err);
                alert("فشل قراءة الملف المضغوط. تأكد أنه غير تالف.");
            }

        } else if (isText) {
             // Read as Text for Prompt Context
             const reader = new FileReader();
             reader.onload = (ev) => {
               if (ev.target?.result) {
                 const textContent = `[FILE_CONTENT: ${file.name}]\n${ev.target.result}`;
                 setAttachments(prev => [...prev, {
                   name: file.name,
                   data: textContent,
                   mimeType: file.type || 'text/plain',
                   type: 'code',
                   size: file.size
                 }]);
               }
             };
             reader.readAsText(file);
        } else {
             // Fallback: Try to read as text anyway, or alert
             const reader = new FileReader();
             reader.onload = (ev) => {
                 setAttachments(prev => [...prev, {
                     name: file.name,
                     data: `[FILE_CONTENT: ${file.name}]\n${ev.target?.result}`,
                     mimeType: 'text/plain',
                     type: 'text',
                     size: file.size
                 }]);
             }
             reader.readAsText(file);
        }
      }
      
      // Reset input
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    const currentSession = activeView === 'code' ? codeSessionRef.current : chatSessionRef.current;
    if (!currentSession) return;

    let userMessageText = input.trim();
    
    // Process Attachments for Gemini
    // 1. Images/Videos/PDFs -> Go to 'inlineData' (attachments param)
    // 2. Text/Code/Zip -> Append to 'userMessageText'
    
    const inlineAttachments: { data: string; mimeType: string }[] = [];
    
    attachments.forEach(att => {
        if (att.type === 'image' || att.type === 'video' || att.type === 'pdf') {
            inlineAttachments.push({ data: att.data, mimeType: att.mimeType });
        } else {
            // It's text/code/zip content -> Add to prompt
            userMessageText += `\n\n${att.data}`;
        }
    });

    const displayAttachments = [...attachments]; // Copy for UI
    
    // Clear Input
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Optimistic UI Update
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: input.trim(), // Show original text in UI, not the appended file content to avoid clutter
      timestamp: Date.now(),
      attachments: displayAttachments // Store attachment metadata for UI
    };

    const aiPlaceholderId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiPlaceholderId,
      role: Role.MODEL,
      content: '',
      timestamp: Date.now() + 1
    };

    setCurrentMessages(prev => [...prev, newUserMessage, aiPlaceholder]);
    setIsLoading(true);

    try {
      // Send the text (which now includes file contents) + inline binaries
      const resultStream = await sendMessageStream(currentSession, userMessageText, inlineAttachments);
      let accumulatedText = '';
      for await (const chunk of resultStream) {
        const responseChunk = chunk as GenerateContentResponse;
        const text = responseChunk.text;
        if (text) {
          accumulatedText += text;
          setCurrentMessages(prev => 
            prev.map(msg => 
              msg.id === aiPlaceholderId ? { ...msg, content: accumulatedText } : msg
            )
          );
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setCurrentMessages(prev => 
        prev.map(msg => 
          msg.id === aiPlaceholderId ? { ...msg, content: 'عذراً، حدث خطأ أثناء المعالجة.', isError: true } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCurrentChat = () => {
    if (window.confirm('هل أنت متأكد من مسح هذه المحادثة؟')) {
      if (activeView === 'code') {
        setCodeMessages([]);
        codeSessionRef.current = createChatSession(ModelType.PRO, "You are Toma Ai, an expert Senior Software Engineer...");
      } else {
        setChatMessages([]);
        chatSessionRef.current = createChatSession(modelType);
      }
      setAttachments([]);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleExportChatToPDF = async () => {
     if (!chatContainerRef.current) return;
     
     // Only allow export if there are messages
     if (getCurrentMessages().length === 0) {
         alert("لا يوجد محادثة لتصديرها.");
         return;
     }

     try {
         // Use html2canvas
         const canvas = await html2canvas(chatContainerRef.current, {
             backgroundColor: '#050505',
             scale: 1, // Normal scale is fine for full page
             useCORS: true,
             ignoreElements: (element) => element.tagName === 'HEADER' || element.tagName === 'ASIDE' // Try to ignore floating elements if they get caught
         });
         
         const imgData = canvas.toDataURL('image/png');
         const pdf = new jsPDF({
             orientation: 'p',
             unit: 'mm',
             format: 'a4'
         });

         const imgProps = pdf.getImageProperties(imgData);
         const pdfWidth = pdf.internal.pageSize.getWidth();
         const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

         // For full chat, we might need multiple pages. 
         // For simplicity in this demo, we create a custom page height to fit the whole chat (long receipt style)
         // or we scale it. Let's do a long single page for best readability of code/text.
         pdf.deletePage(1);
         pdf.addPage([pdfWidth, pdfHeight + 20]);
         pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
         
         pdf.save(`toma_chat_history_${Date.now()}.pdf`);

     } catch (e) {
         console.error("Export failed", e);
         alert("فشل تصدير المحادثة.");
     }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderSidebarItem = (view: ViewMode, icon: React.ElementType, label: string) => (
    <button
      onClick={() => {
        setActiveView(view);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
        activeView === view 
          ? 'text-white font-semibold' 
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {activeView === view && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 backdrop-blur-sm border border-white/10 rounded-2xl"></div>
      )}
      <div className={`relative z-10 p-2 rounded-xl transition-all ${activeView === view ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-white/5'}`}>
        {React.createElement(icon, { size: 18, className: activeView === view ? 'text-white' : 'text-slate-400' })}
      </div>
      <span className="relative z-10 text-sm">{label}</span>
    </button>
  );

  const showHeader = !['voice_face', 'website_pro', 'flutter', 'video_to_code'].includes(activeView);

  return (
    <div className="flex h-screen w-full p-0 sm:p-2 md:p-4 gap-4 bg-transparent font-sans overflow-hidden">
      
      {/* Sidebar - Floating Glass */}
      <aside className={`
          fixed md:relative inset-y-0 right-0 z-40 w-72 
          transform transition-transform duration-300 ease-out
          ${isSidebarOpen ? 'translate-x-0 bg-black/80 backdrop-blur-xl md:translate-x-0' : 'translate-x-full md:hidden'}
          glass-panel md:rounded-3xl flex flex-col md:mr-0 h-full
        `}>
          <div className="p-6 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                 <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-40 animate-pulse-slow"></div>
                 <Icons.Cpu className="relative z-10 text-cyan-400" size={28} />
              </div>
              <div>
                 <h1 className="font-bold text-xl text-white tracking-wide neon-text">Toma Ai</h1>
                 <span className="text-[10px] text-cyan-300/70 tracking-widest uppercase">نظام المستقبل</span>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white"><Icons.Close /></button>
          </div>

          <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar">
             <div className="mb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-widest">الوحدات</div>
             {renderSidebarItem('chat', Icons.Chat, 'المحادثة الذكية')}
             {renderSidebarItem('voice_face', Icons.Headset, 'المساعد الصوتي 3D')}
             {renderSidebarItem('code', Icons.Code, 'مهندس الكود')}
             
             <div className="mb-2 mt-4 px-2 text-xs font-bold text-purple-400 uppercase tracking-widest">التطوير المتقدم</div>
             {renderSidebarItem('video_to_code', Icons.Scan, 'المحلل العكسي (Video 2 Code)')}
             {renderSidebarItem('website_pro', Icons.Rocket, 'Next.js Builder PRO')}
             {renderSidebarItem('website', Icons.Layout, 'منشئ المواقع (بسيط)')}
             {renderSidebarItem('flutter', Icons.Smartphone, 'Flutter App Builder')}
             
             <div className="my-2 border-t border-white/5 mx-2"></div>
             {renderSidebarItem('game', Icons.Box, 'محرك 3D (ثلاثي الأبعاد)')}
             {renderSidebarItem('game2d', Icons.Gamepad, 'محرك 2D (احترافي)')}
             {renderSidebarItem('model3d', Icons.Cube, 'مختبر المجسمات 3D')}
             <div className="my-2 border-t border-white/5 mx-2"></div>
             {renderSidebarItem('video', Icons.Video, 'استوديو الفيديو (Veo)')}
             {renderSidebarItem('image', Icons.Image, 'استوديو الصور')}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/20">
             {(activeView === 'chat' || activeView === 'code') && (
                 <div className="flex flex-col gap-2">
                     <button 
                       onClick={handleExportChatToPDF}
                       className="w-full flex items-center justify-center gap-2 px-4 py-3 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl transition-all border border-transparent hover:border-cyan-500/20"
                     >
                        <Icons.PDF size={16} />
                        <span className="text-sm font-medium">تصدير المحادثة PDF</span>
                     </button>
                     <button 
                       onClick={handleClearCurrentChat}
                       className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                     >
                       <Icons.Trash size={16} />
                       <span className="text-sm font-medium">مسح الذاكرة</span>
                     </button>
                 </div>
             )}
             <div className="mt-4 text-center">
               <p className="text-[10px] text-slate-600">تم التطوير بواسطة <span className="text-cyan-600">تامر محمد صالح</span></p>
             </div>
          </div>
      </aside>

      {/* Main Content - Floating Glass */}
      <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden glass-panel rounded-none sm:rounded-3xl shadow-2xl">
        
        {/* Top Bar */}
        {showHeader && (
          <header className="flex-none h-16 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-white/5 backdrop-blur-md z-10">
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className={`p-2 text-slate-400 hover:text-white glass-button rounded-lg ${isSidebarOpen ? 'hidden md:flex opacity-50' : 'flex'}`}
                >
                  <Icons.Menu size={20} />
                </button>
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-slate-200">
                     {activeView === 'code' ? 'النظام: مهندس الكود' : 
                      activeView === 'image' ? 'النظام: استوديو الرؤية' : 
                      activeView === 'video' ? 'النظام: محرك Veo' : 
                      activeView === 'website' ? 'النظام: محرك الويب' :
                      activeView === 'game' ? 'النظام: محرك الألعاب 3D' :
                      activeView === 'game2d' ? 'النظام: محرك الألعاب 2D' :
                      activeView === 'model3d' ? 'النظام: مختبر المجسمات 3D' :
                      activeView === 'flutter' ? 'النظام: Flutter Builder' :
                      activeView === 'video_to_code' ? 'النظام: المحلل العكسي' :
                      'النظام: المحادثة العصبية'}
                  </h2>
                  <div className="flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                     <span className="text-[10px] text-green-500/80 font-mono uppercase">متصل</span>
                  </div>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
               {(activeView === 'chat' || activeView === 'code') && (
                  <ModelSelector currentModel={modelType} onSelect={setModelType} disabled={isLoading} />
               )}
             </div>
          </header>
        )}

        {/* Dynamic Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
           {activeView === 'image' ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ImageGenerator />
              </div>
           ) : activeView === 'video' ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <VideoGenerator />
              </div>
           ) : activeView === 'website' ? (
              <div className="flex-1 overflow-hidden">
                <WebsiteBuilder />
              </div>
           ) : activeView === 'website_pro' ? (
              <div className="flex-1 overflow-hidden">
                <WebsiteBuilderPro />
              </div>
           ) : activeView === 'flutter' ? (
              <div className="flex-1 overflow-hidden">
                <FlutterBuilder />
              </div>
           ) : activeView === 'video_to_code' ? (
              <div className="flex-1 overflow-hidden">
                <VideoToCode />
              </div>
           ) : activeView === 'game' ? (
              <div className="flex-1 overflow-hidden">
                <GameBuilder initialDimension="3d" />
              </div>
           ) : activeView === 'game2d' ? (
              <div className="flex-1 overflow-hidden">
                <GameBuilder initialDimension="2d" />
              </div>
           ) : activeView === 'model3d' ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ThreeDAssetGen />
              </div>
           ) : activeView === 'voice_face' ? (
              <div className="flex-1 overflow-hidden">
                  <VoiceAvatar />
              </div>
           ) : (
             <>
               {getCurrentMessages().length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                    <div className="relative mb-8">
                       <div className="absolute inset-0 bg-cyan-500/30 blur-3xl animate-pulse-slow rounded-full"></div>
                       <div className={`relative w-24 h-24 rounded-3xl flex items-center justify-center glass-button border-white/10
                         ${activeView === 'code' ? 'shadow-[0_0_30px_rgba(79,70,229,0.3)]' : 'shadow-[0_0_30px_rgba(6,182,212,0.3)]'}`}>
                         {activeView === 'code' ? <Icons.Code className="text-indigo-400" size={40} /> : <Icons.Bot className="text-cyan-400" size={48} />}
                       </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                      {activeView === 'code' ? 'بانتظار البروتوكول...' : 'الواجهة العصبية جاهزة'}
                    </h2>
                    <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-8">
                      {activeView === 'code' 
                        ? 'جاهز لاستقبال ملفاتك البرمجية (ZIP, JS, PY...)، تحليلها وتطويرها.' 
                        : 'أدعم الآن تحليل الصور، ملفات PDF، والمستندات. يمكنك إرسال ملف وسأقوم بتحليله أو تعديله.'}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                       {(activeView === 'code' 
                         ? ['قم بتحليل كود Python هذا...', 'ابحث عن الأخطاء في ملف ZIP...', 'اشرح خوارزمية الكم...', 'حول الكود إلى C++...'] 
                         : ['لخص ملف PDF المرفق...', 'حلل الصورة المرفقة...', 'ماذا يوجد في هذا الملف؟', 'أرسل لي كود لعبة Snake...'])
                         .map((suggestion, idx) => (
                         <button 
                           key={idx}
                           onClick={() => { setInput(suggestion); if(textareaRef.current) textareaRef.current.focus(); }}
                           className="p-4 glass-button rounded-xl text-right text-sm text-slate-300 hover:text-white hover:border-cyan-500/50 transition-all text-xs font-mono"
                         >
                           {'>'} {suggestion}
                         </button>
                       ))}
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar" ref={chatContainerRef}>
                   {getCurrentMessages().map((msg) => (
                     <ChatMessage key={msg.id} message={msg} />
                   ))}
                   <div ref={messagesEndRef} className="h-4" />
                 </div>
               )}

               {/* Futuristic Input Area */}
               <div className="flex-none p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent">
                  {/* Attachments Preview */}
                  {attachments.length > 0 && (
                     <div className="flex gap-2 mb-2 overflow-x-auto custom-scrollbar pb-2">
                        {attachments.map((att, i) => (
                           <div key={i} className="relative w-24 h-24 flex-shrink-0 bg-white/5 rounded-xl border border-white/10 overflow-hidden group flex flex-col items-center justify-center p-2 text-center">
                              {att.type === 'image' ? (
                                <img src={att.data} alt="att" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                              ) : att.type === 'video' ? (
                                <div className="text-slate-400"><Icons.Video size={24} /></div>
                              ) : att.type === 'pdf' ? (
                                <div className="text-red-400"><Icons.PDF size={24} /></div>
                              ) : att.type === 'zip' ? (
                                <div className="text-yellow-400"><Icons.Zip size={24} /></div>
                              ) : (
                                <div className="text-blue-400"><Icons.Code size={24} /></div>
                              )}
                              
                              <span className="relative z-10 text-[8px] text-white font-mono mt-1 truncate w-full px-1 bg-black/50 rounded">{att.name}</span>
                              <button 
                                onClick={() => removeAttachment(i)}
                                className="absolute top-1 right-1 text-red-400 hover:text-red-300 bg-black/80 rounded-full z-20 p-0.5"
                              >
                                 <Icons.Remove size={12} />
                              </button>
                           </div>
                        ))}
                     </div>
                  )}

                  <div className="max-w-4xl mx-auto relative glass-panel rounded-2xl flex items-end gap-2 p-2 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
                     <button
                       onClick={() => fileInputRef.current?.click()}
                       className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-all flex-shrink-0 group relative"
                       title="إرفاق ملفات (صور، فيديو، PDF، كود، ZIP)"
                     >
                        <Icons.Paperclip size={20} />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-[9px] bg-black border border-white/10 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            PDF, ZIP, Code, Media
                        </span>
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       hidden 
                       multiple 
                       onChange={handleFileSelect}
                     />

                     <textarea
                       ref={textareaRef}
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       onKeyDown={handleKeyDown}
                       placeholder={activeView === 'code' ? "// أدخل الأمر أو ارفع ملف للكود..." : "اكتب رسالة أو ارفع ملف (PDF, ZIP, صور)..."}
                       className="flex-1 max-h-48 bg-transparent border-none focus:ring-0 p-3 text-white placeholder-slate-500 resize-none text-base leading-relaxed font-sans text-right"
                       dir="auto"
                       rows={1}
                     />
                     <button
                       onClick={handleSendMessage}
                       disabled={(!input.trim() && attachments.length === 0) || isLoading}
                       className={`p-3 rounded-xl flex-shrink-0 transition-all duration-300 ${
                         (input.trim() || attachments.length > 0) && !isLoading
                           ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                           : 'bg-white/5 text-slate-600'
                       }`}
                     >
                       {isLoading ? <Icons.Loader className="animate-spin" size={20} /> : <Icons.Send size={20} className="rotate-180 rtl:rotate-0" />}
                     </button>
                  </div>
               </div>
             </>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;