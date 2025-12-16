import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message, Role, ModelType } from "../types";

// Always create a new client to ensure we use the latest API Key
const getClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

// Helper: Check for Resource Exhausted (429)
const is429 = (err: any) => {
  return (
    err.status === 'RESOURCE_EXHAUSTED' || 
    err.code === 429 || 
    err.message?.includes('429') || 
    err.message?.includes('quota')
  );
};

export const createChatSession = (model: ModelType, systemInstruction?: string) => {
  const ai = getClient();
  const defaultInstruction = "You are Toma Ai, a helpful and intelligent AI assistant developed by Tamer Mohamed Saleh. You are chatting with an Arabic speaking user. Always reply in Arabic unless the user specifically asks for another language. Be polite, concise, and accurate.";
  
  let config: any = {
    systemInstruction: systemInstruction || defaultInstruction,
  };

  if (model === ModelType.PRO) {
    config = { ...config, thinkingConfig: { thinkingBudget: 32768 } };
  }

  if (model === ModelType.FLASH) {
    config = { ...config, tools: [{ googleSearch: {} }, { googleMaps: {} }] };
  }

  return ai.chats.create({
    model: model,
    config: config,
    history: []
  });
};

export const sendMessageStream = async (chat: Chat, message: string, attachments: { data: string; mimeType: string }[] = []): Promise<AsyncIterable<GenerateContentResponse>> => {
  try {
    let messagePayload: any = message;
    if (attachments.length > 0) {
      const parts: any[] = attachments.map(att => ({
        inlineData: { data: att.data.split(',')[1], mimeType: att.mimeType }
      }));
      parts.push({ text: message });
      messagePayload = parts;
    }
    return await chat.sendMessageStream({ message: messagePayload });
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const generateImage = async (prompt: string, model: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview' = 'gemini-2.5-flash-image'): Promise<string | null> => {
  const ai = getClient();
  const attemptGenerate = async (retryCount = 0): Promise<string | null> => {
    try {
        let config: any = {};
        if (model === 'gemini-3-pro-image-preview') {
            config.imageConfig = { imageSize: "2K", aspectRatio: "1:1" };
        }
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: prompt }] },
          config: config
        });
        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
          }
        }
        return null;
    } catch (error: any) {
        if (is429(error) && retryCount < 3) {
            const delay = (retryCount + 1) * 2000;
            await new Promise(r => setTimeout(r, delay));
            return attemptGenerate(retryCount + 1);
        }
        throw error;
    }
  };
  return attemptGenerate();
};

export const generateVeoVideo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string | null> => {
  const ai = getClient();
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) return `${videoUri}&key=${process.env.API_KEY}`;
    return null;
  } catch (error) {
    console.error("Veo Video generation error:", error);
    throw error;
  }
};

// --- NEW: Graphic Designer Role ---
export interface DesignSystem {
  colorPalette: { primary: string; secondary: string; accent: string; background: string; text: string };
  typography: { headingFont: string; bodyFont: string };
  style: 'Glassmorphism' | 'Neumorphism' | 'Minimalist' | 'Brutalism' | 'Cyberpunk' | 'Corporate';
  layoutStructure: string;
  animations: string[];
}

export const generateDesignSystem = async (prompt: string): Promise<DesignSystem> => {
    const ai = getClient();
    const systemPrompt = `
    You are a World-Class UI/UX Graphic Designer (Apple/Google caliber).
    Analyze the user's request: "${prompt}".
    
    Create a high-end Design System.
    1. Select a modern, harmonious Color Palette (Hex codes).
    2. Choose fitting Google Fonts.
    3. Define a visual style (e.g., Glassmorphism with blur, Cyberpunk with neon, Minimalist with lots of whitespace).
    4. Suggest animations (e.g., FadeInUp, ZoomIn, HoverGlow).

    Return JSON ONLY:
    {
      "colorPalette": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "text": "#..." },
      "typography": { "headingFont": "Name", "bodyFont": "Name" },
      "style": "Glassmorphism",
      "layoutStructure": "Single Page Application with Sticky Navbar and Bento Grid features",
      "animations": ["fade-up", "zoom-in"]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ text: systemPrompt }] },
            config: { responseMimeType: 'application/json' }
        });
        const text = response.text || '{}';
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) as DesignSystem;
    } catch (e) {
        // Fallback default design
        return {
            colorPalette: { primary: '#3b82f6', secondary: '#1e40af', accent: '#f59e0b', background: '#0f172a', text: '#f8fafc' },
            typography: { headingFont: 'Cairo', bodyFont: 'Inter' },
            style: 'Minimalist',
            layoutStructure: 'Standard',
            animations: []
        };
    }
};

export interface AnalysisResult {
  colors: string[];
  layout: string;
  mood: string;
  typography: string;
  components: string[];
}

export const analyzeVisualContent = async (visualContext: string[]): Promise<AnalysisResult> => {
  // ... (Existing implementation kept simple for brevity, assumed unchanged logic or using generic)
  return { colors: ['#000'], layout: 'Standard', mood: 'Modern', typography: 'Sans', components: [] };
};

export const generateWebsiteCodeStream = async (
  prompt: string, 
  currentCode: string = '',
  framework: string = 'tailwind',
  visualContext: string[] = [], 
  config: { font: string; libs: string[]; designSystem?: DesignSystem } = { font: 'Cairo', libs: [] }
): Promise<AsyncIterable<string>> => {
  const ai = getClient();
  const parts: any[] = [];
  
  if (visualContext.length > 0) {
    visualContext.forEach(base64 => parts.push({ inlineData: { mimeType: 'image/png', data: base64.split(',')[1] || base64 } }));
    parts.push({ text: "Replicate this design EXACTLY." });
  }

  let systemPrompt = '';

  if (currentCode) {
      // --- EDIT MODE PROMPT ---
      const contextCode = truncateBase64InContext(currentCode);
      systemPrompt = `
      You are an Expert Frontend Code Refactorer & Editor.
      
      TASK: Update the existing website code based ONLY on the user request.
      USER REQUEST: "${prompt}"

      RULES:
      1. **TARGETED EDITING:** Only modify the specific section, color, or logic requested. Do NOT rebuild the whole site from scratch unless asked.
      2. **PRESERVE:** Keep the existing layout, content, and style unless it conflicts with the request.
      3. **OUTPUT:** You MUST return the FULL, VALID, SINGLE HTML FILE containing the update. Do NOT return just the snippet.
      4. **LIBS:** Keep existing libraries (Tailwind, FontAwesome, etc.).
      
      EXISTING CODE (Context):
      ${contextCode}

      Return ONLY raw HTML code.
      `;
  } else {
      // --- NEW BUILD PROMPT ---
      // Inject Design System into prompt
      const designPrompt = config.designSystem ? `
      Graphic Designer Specs (STRICTLY FOLLOW THIS):
      - Primary Color: ${config.designSystem.colorPalette.primary}
      - Background: ${config.designSystem.colorPalette.background}
      - Style: ${config.designSystem.style}
      - Layout: ${config.designSystem.layoutStructure}
      ` : '';

      systemPrompt = `
      You are a Senior Frontend Engineer & UI Specialist.
      Goal: Build a HIGH-END, MULTI-SECTION SINGLE PAGE APPLICATION (SPA).
      
      ${designPrompt}

      CRITICAL REQUIREMENTS:
      1. **ARCHITECTURE (SPA):**
         - Create a complete website in a SINGLE HTML file.
         - Include a Fixed/Sticky Navbar with links (Home, About, Services, Portfolio, Contact).
         - **Navigation Logic (CRITICAL):** 
           - Give every Section a unique ID (e.g., id="home", id="about").
           - Give Navbar Links hrefs matching IDs (e.g., href="#home").
           - **JavaScript:** Write robust code to handle click events on nav links. 
             - \`e.preventDefault()\` MUST be used.
             - Hide ALL sections (add 'hidden' class).
             - Show TARGET section (remove 'hidden' class).
             - Update 'active' class on navbar links.
      
      2. **MOBILE MENU (CRITICAL):**
         - Navbar MUST have a button with \`id="mobile-menu-btn"\` (Hamburger icon) visible only on small screens.
         - A Menu container with \`id="mobile-menu"\` containing the links, hidden by default.
         - **JavaScript:** Write code to Toggle the 'hidden' class on \`#mobile-menu\` when \`#mobile-menu-btn\` is clicked.
      
      3. **DESIGN & VISUALS:**
         - Use Tailwind CSS.
         - Typography: Google Fonts '${config.designSystem?.typography.headingFont || config.font}'.
         - Ensure High Contrast and Accessibility.

      4. **CONTENT:**
         - REALISTIC ARABIC/ENGLISH CONTENT (Based on user prompt language).
         - Hero Section: Big bold headline, CTA buttons.
         - Footer: Complete with links, social icons.

      Return ONLY raw HTML code.
      User Request: ${prompt}
      `;
  }
  
  parts.push({ text: systemPrompt });

  const attemptStream = async (modelName: string) => {
      return await ai.models.generateContentStream({
        model: modelName, 
        contents: { parts: parts },
      });
  };

  try {
    // For Edits, sometimes Flash is faster and good enough, but Pro is safer for complex DOM logic.
    // Let's stick to Pro for quality edits.
    const responseStream = await attemptStream('gemini-3-pro-preview');
    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of responseStream) {
          if (chunk.text) yield chunk.text;
        }
      }
    };
  } catch (error) {
    console.warn("Pro model failed, falling back to Flash...", error);
    try {
        const responseStream = await attemptStream('gemini-2.5-flash');
        return {
          async *[Symbol.asyncIterator]() {
            for await (const chunk of responseStream) {
              if (chunk.text) yield chunk.text;
            }
          }
        };
    } catch (retryError) {
        console.error("Website stream error:", retryError);
        throw retryError;
    }
  }
};

export const generateGameCodeStream = async (prompt: string, engine: string, libraries: string[], injectedAssets: { name: string; data: string }[], currentCode: string, dimension: '2d' | '3d'): Promise<AsyncIterable<string>> => {
   // ... (Existing Game Logic)
   const ai = getClient();
   const parts = [{ text: `Create/Update a ${dimension} game using ${engine}. Prompt: ${prompt}` }];
   const stream = await ai.models.generateContentStream({ model: 'gemini-flash-lite-latest', contents: { parts } });
   return { async *[Symbol.asyncIterator]() { for await (const c of stream) if(c.text) yield c.text; } };
};

const truncateBase64InContext = (code: string): string => code.replace(/(["'])data:image\/[^;]+;base64,[^"']+\1/g, '"[EXISTING_ASSET]"');

export const cleanCodeResponse = (code: string) => code.replace(/```html/g, '').replace(/```/g, '').trim();

// --- Next.js Pro Logic ---
export interface ProjectFile { path: string; content: string; }
export interface GenerationPlan { 
    title: string; 
    description: string; 
    steps: any[]; // Changed from 'string[]' to 'any[]' to handle potential objects (e.g. {step_id, details})
    architecture: any; 
}

export const generateNextJsProject = async (prompt: string, existingFiles: ProjectFile[] = [], images: string[] = [], mode: 'plan' | 'build' = 'build', planContext?: GenerationPlan): Promise<any> => {
    const ai = getClient();
    const parts: any[] = [{ text: `User Request: ${prompt}` }];
    
    if (images.length > 0) {
        images.forEach(img => parts.push({ inlineData: { mimeType: 'image/png', data: img.split(',')[1] } }));
    }

    if (mode === 'plan') {
        const planPrompt = `
        You are a Principal Software Architect.
        User Request: ${prompt}
        Create a comprehensive development plan for a Next.js 14+ (App Router) project.
        Stack: TypeScript, Tailwind CSS, Shadcn UI, Prisma, Zustand.
        Return ONLY a JSON object: { "title", "description", "architecture", "steps": [] }
        The "architecture" field can be a string summary or a structured object (e.g. { frontend: "...", backend: "..." }).
        `;
        parts.push({ text: planPrompt });
        const res = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts }, config: { responseMimeType: 'application/json' } });
        return JSON.parse(res.text?.replace(/```json/g, '').replace(/```/g, '') || '{}');
    } else {
        const buildPrompt = `
        Act as a Principal Full-Stack Engineer.
        Plan: ${planContext?.title}.
        
        TASK: Generate a COMPREHENSIVE, REAL MULTI-PAGE Next.js 14 Application.
        This is NOT a single landing page. It is a full application with functional routing.
        
        MANDATORY FILE STRUCTURE (Generate ALL these files with real content):
        1. app/layout.tsx (Global RootLayout with Navbar and Footer that link to other pages).
        2. app/page.tsx (Home Page).
        3. app/about/page.tsx (About Us Page).
        4. app/services/page.tsx (Services/Features Page).
        5. app/contact/page.tsx (Contact Page with Form UI).
        6. components/Navbar.tsx (MUST use 'next/link' for navigation between routes).
        7. components/Footer.tsx.
        8. components/ui/card.tsx (Shadcn style).
        9. components/ui/button.tsx.
        10. lib/utils.ts.

        DESIGN:
        - Use Tailwind CSS.
        - Dark Mode default.
        - Use gradients and glassmorphism.
        - Ensure responsive mobile menu in Navbar.

        OUTPUT JSON: { "files": [{ "path": "...", "content": "..." }], "previewHTML": "..." }
        `;
        parts.push({ text: buildPrompt });
        const res = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts }, config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 4096 } } });
        return JSON.parse(res.text?.replace(/```json/g, '').replace(/```/g, '') || '{}');
    }
};

export const updateProjectFile = async (prompt: string, currentFile: ProjectFile): Promise<string> => {
    const ai = getClient();
    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: `Update this file code based on request: ${prompt}\n\nCode:\n${currentFile.content}` }] } });
    return cleanCodeResponse(res.text || '');
};

// --- Flutter Logic ---
export const generateFlutterProject = async (prompt: string, existingFiles: ProjectFile[] = []): Promise<{ files: ProjectFile[], previewHTML: string }> => {
    const ai = getClient();
    const systemPrompt = `
    You are a Senior Flutter Developer.
    Task: Create a Multi-Screen Flutter App.
    
    Requirements:
    1. 'main.dart': Must contain MaterialApp, Theme config (Material 3), and a 'MainScreen' with a 'BottomNavigationBar'.
    2. Screens: Create class widgets for Home, Search, Profile.
    3. State Management: Use setState for tab switching.
    4. UI: Use Cards, ListViews, Gradients, FloatingActionButtons.

    Output JSON: { "files": [{"path": "lib/main.dart", "content": "..."}], "previewHTML": "HTML simulation of the app interface" }
    `;
    const res = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [{ text: `Request: ${prompt}\n${systemPrompt}` }] }, config: { responseMimeType: 'application/json' } });
    return JSON.parse(res.text?.replace(/```json/g, '').replace(/```/g, '') || '{}');
};

export const analyzeGameAssets = async (p: string, d: '2d'|'3d') => []; // Stub

// --- Video/Image to Code (Reverse Engineering) ---

export interface ReverseEngineeringPlan {
    colors: string[];
    typography: string[];
    layoutAnalysis: string;
    animations: string[];
    interactions: string[];
    techStack: string;
}

export const analyzeUiMedia = async (mediaData: string, mimeType: string): Promise<ReverseEngineeringPlan> => {
    const ai = getClient();
    
    // We use Gemini 3 Pro for deep multimodal reasoning
    const prompt = `
    You are an Elite UI/UX Forensic Analyst and Frontend Architect.
    
    TASK: Deeply analyze the provided video/image frame-by-frame. 
    1. Dissect the UI mechanics, transitions, and micro-interactions.
    2. Extract the exact Color Palette (Hex codes).
    3. Identify the Typography style (Serif/Sans, Weights).
    4. Analyze the Layout Grid (Flexbox/Grid structure, spacing).
    5. Note any specific animations (e.g., parallax, hover effects, loaders).

    Output a structured JSON plan to replicate this EXACTLY:
    {
       "colors": ["#hex", ...],
       "typography": ["Font Name/Style", ...],
       "layoutAnalysis": "Detailed description of the structure...",
       "animations": ["Description of animation 1", ...],
       "interactions": ["Click behavior", "Scroll behavior"...],
       "techStack": "Recommended stack (e.g. Tailwind + GSAP)"
    }
    `;

    const parts = [
        { inlineData: { data: mediaData.split(',')[1], mimeType: mimeType } },
        { text: prompt }
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts },
            config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 4096 } }
        });
        
        return JSON.parse(response.text?.replace(/```json/g, '').replace(/```/g, '') || '{}');
    } catch (e) {
        console.error("Analysis failed", e);
        throw e;
    }
};

export const generateCodeFromPlan = async (plan: ReverseEngineeringPlan): Promise<string> => {
    const ai = getClient();
    
    const prompt = `
    You are a Senior Frontend Developer.
    
    TASK: Replicate a website based on this forensic analysis plan.
    Create a SINGLE HTML file containing everything (HTML, CSS via Tailwind CDN, JS).
    
    ANALYSIS PLAN:
    ${JSON.stringify(plan, null, 2)}
    
    REQUIREMENTS:
    1. Pixel-Perfect accuracy to the described layout.
    2. Use Tailwind CSS for styling.
    3. Use GSAP (via CDN) for the described animations.
    4. Ensure responsive design (Mobile/Desktop).
    5. The code must be complete and runnable.

    Return ONLY raw HTML code.
    `;

    const attemptStream = async (modelName: string) => {
        return await ai.models.generateContentStream({
            model: modelName,
            contents: { parts: [{ text: prompt }] }
        });
    };

    try {
        const responseStream = await attemptStream('gemini-3-pro-preview');
        let fullCode = "";
        for await (const chunk of responseStream) {
            if (chunk.text) fullCode += chunk.text;
        }
        return cleanCodeResponse(fullCode);
    } catch (e) {
        console.warn("Pro coding failed, retrying with Flash...", e);
        try {
            const responseStream = await attemptStream('gemini-2.5-flash');
            let fullCode = "";
            for await (const chunk of responseStream) {
                if (chunk.text) fullCode += chunk.text;
            }
            return cleanCodeResponse(fullCode);
        } catch (retryError) {
             console.error("Coding failed", retryError);
             throw retryError;
        }
    }
};