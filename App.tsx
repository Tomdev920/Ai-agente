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

type ViewMode = 'chat' | 'code' | 'image' | 'video' | 'website' | 'website_pro' | 'game' | 'game2d' | 'model3d' | 'voice_face' | 'flutter' | 'video_to_code';

interface Attachment {
  data: string; // Base64
  mimeType: string;
  type: 'image' | 'video';
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            const base64 = ev.target.result as string;
            const isVideo = file.type.startsWith('video/');
            setAttachments(prev => [...prev, {
              data: base64,
              mimeType: file.type,
              type: isVideo ? 'video' : 'image'
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
      // Reset input so same file can be selected again
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

    const userMessageText = input.trim();
    const currentAttachments = [...attachments];
    
    // Clear Input
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Optimistic UI Update
    const displayContent = userMessageText + 
      (currentAttachments.length > 0 ? `\n\n*[مرفق: ${currentAttachments.length} ملفات]*` : '');

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: displayContent,
      timestamp: Date.now()
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
      const resultStream = await sendMessageStream(currentSession, userMessageText, currentAttachments);
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
                 <button 
                   onClick={handleClearCurrentChat}
                   className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                 >
                   <Icons.Trash size={16} />
                   <span className="text-sm font-medium">مسح الذاكرة</span>
                 </button>
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
                        ? 'جاهز لبناء خوارزميات معقدة وأنظمة آمنة.' 
                        : 'متصل بنواة Gemini Pro & Flash مع قدرات البحث (Grounding).'}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                       {(activeView === 'code' 
                         ? ['أنشئ سكريبت Python...', 'صحح مكون React...', 'اشرح خوارزمية الكم...', 'أنشئ قاعدة بيانات SQL...'] 
                         : ['بحث في جوجل عن...', 'تحليل منطقي (Thinking)...', 'أماكن سياحية في...', 'خطة تسويق...'])
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
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
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
                           <div key={i} className="relative w-20 h-20 flex-shrink-0 bg-white/5 rounded-xl border border-white/10 overflow-hidden group">
                              {att.type === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                   <Icons.Video size={24} />
                                </div>
                              ) : (
                                <img src={att.data} alt="att" className="w-full h-full object-cover" />
                              )}
                              <button 
                                onClick={() => removeAttachment(i)}
                                className="absolute top-1 right-1 text-red-400 hover:text-red-300 bg-black/60 rounded-full"
                              >
                                 <Icons.Remove size={16} />
                              </button>
                           </div>
                        ))}
                     </div>
                  )}

                  <div className="max-w-4xl mx-auto relative glass-panel rounded-2xl flex items-end gap-2 p-2 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
                     <button
                       onClick={() => fileInputRef.current?.click()}
                       className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-all flex-shrink-0"
                       title="إرفاق صورة/فيديو"
                     >
                        <Icons.Paperclip size={20} />
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       hidden 
                       multiple 
                       accept="image/*,video/*"
                       onChange={handleFileSelect}
                     />

                     <textarea
                       ref={textareaRef}
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       onKeyDown={handleKeyDown}
                       placeholder={activeView === 'code' ? "// أدخل الأمر..." : "اكتب رسالة..."}
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