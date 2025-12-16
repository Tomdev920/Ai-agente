import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icon';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (code: string, lang: string) => {
      // Create blob and download
      const extMap: Record<string, string> = {
          javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
          python: 'py', py: 'py', html: 'html', css: 'css',
          json: 'json', java: 'java', cpp: 'cpp', c: 'c',
          bash: 'sh', shell: 'sh', markdown: 'md'
      };
      const ext = extMap[lang.toLowerCase()] || 'txt';
      const filename = `toma_generated_${Date.now()}.${ext}`;
      
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div className="prose prose-invert max-w-none break-words text-sm sm:text-base leading-relaxed" dir="auto">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');
            const renderIndex = codeString.length; 

            return isInline ? (
              <code className="bg-white/10 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 border border-white/5" {...props}>
                {children}
              </code>
            ) : (
              <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#0a0a0a]/80 backdrop-blur-xl group" dir="ltr">
                 <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{match?.[1] || 'TEXT'}</span>
                    <div className="flex items-center gap-3">
                      {/* Download Button (AI Sending File Feature) */}
                      <button 
                        onClick={() => handleDownload(codeString, match?.[1] || 'txt')}
                        className="text-slate-400 hover:text-green-400 transition-colors flex items-center gap-1.5"
                        title="Download as File"
                      >
                         <Icons.Download size={14} />
                         <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">DL</span>
                      </button>

                      <button 
                        onClick={() => handleCopy(codeString, renderIndex)}
                        className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                      >
                        {copiedIndex === renderIndex ? (
                          <>
                            <Icons.Check size={14} className="text-green-400" />
                            <span className="text-[10px] text-green-400 font-mono">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Icons.Copy size={14} />
                            <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">COPY</span>
                          </>
                        )}
                      </button>
                    </div>
                 </div>
                 <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match?.[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '0.85em',
                    lineHeight: '1.6',
                    background: 'transparent',
                    padding: '1.5rem'
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          ul: ({ children }) => <ul className="list-disc list-outside ms-4 my-2 text-slate-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ms-4 my-2 text-slate-300">{children}</ol>,
          p: ({ children }) => <p className="mb-3 last:mb-0 text-slate-200">{children}</p>,
          strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-500/30 hover:decoration-cyan-300 transition-all">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};