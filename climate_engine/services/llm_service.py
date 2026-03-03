// BULLETPROOF AI TEXT FORMATTER
const formatAiText = (text: string, title: string) => {
  if (!text) return null;

  // Check if it has EFFECT and SOLUTION tags (even if Groq renames CAUSE)
  if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
    
    // Split the string into the three parts
    const parts = text.split('**EFFECT:**');
    const rawCause = parts[0];
    const effectAndSolution = parts[1].split('**SOLUTION:**');
    
    // Clean out any rogue markdown asterisks (**) and leftover colons (:)
    const cause = rawCause.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    const effect = effectAndSolution[0].replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    const solution = effectAndSolution[1].replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    
    return (
      <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
        <div className="border-b border-slate-800/80 pb-3">
           <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
        </div>
        <div className="space-y-4 flex-grow">
           <div>
              <span className="font-mono text-[9px] text-red-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-red-500"></div> Cause</span>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{cause}</p>
           </div>
           <div>
              <span className="font-mono text-[9px] text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-orange-400"></div> Effect</span>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{effect}</p>
           </div>
           <div>
              <span className="font-mono text-[9px] text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-emerald-400"></div> Solution</span>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{solution}</p>
           </div>
        </div>
      </div>
    );
  }

  // Fallback for flat string from backend (cleans asterisks just in case)
  return (
    <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
      <div className="border-b border-slate-800/80 pb-3">
         <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{text.replace(/\*\*.*?\*\*:?/g, '').trim()}</p>
    </div>
  );
};