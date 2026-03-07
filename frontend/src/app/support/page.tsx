'use client';

import React, { useState } from "react";

const FAQS = [
  {
    q: "What does OpenPlanet actually do?",
    a: "OpenPlanet is a climate intelligence platform that translates global climate data into localized risk projections. The platform models heat-related mortality, economic productivity loss, and extreme weather exposure at city-scale resolution. Users can simulate mitigation strategies such as urban tree canopy expansion and reflective roofing to evaluate potential risk reduction."
  },
  {
    q: "Where does OpenPlanet get its climate data?",
    a: "OpenPlanet integrates global datasets from leading scientific institutions including the Copernicus Climate Data Store (ERA5 reanalysis), NASA Earth observation archives, and CMIP6 climate model projections. These datasets are combined with epidemiological and economic research frameworks to estimate localized climate risk."
  },
  {
    q: "Are the projections predictions of the future?",
    a: "No. OpenPlanet generates probabilistic climate risk projections based on scientific models and historical data. The results represent simulated scenarios and risk estimates rather than guaranteed future outcomes. They are intended for research, planning, and strategic analysis."
  },
  {
    q: "Who is OpenPlanet designed for?",
    a: "OpenPlanet is designed for organizations and professionals working with climate risk and infrastructure planning, including: Urban planners and city governments, Climate researchers and universities, Infrastructure and energy analysts, Insurance and financial risk analysts, and Climate technology investors."
  },
  {
    q: "How accurate are the climate risk models?",
    a: "The platform uses peer-reviewed scientific frameworks including epidemiological mortality models, global climate reanalysis datasets, and probabilistic Monte Carlo simulations. While these methods provide high-confidence estimates, all climate modeling contains inherent uncertainty."
  },
  {
    q: "Can I export or download the data?",
    a: "Yes. OpenPlanet allows users to export selected datasets and simulation outputs in formats such as CSV or GeoJSON for research, planning, or integration with external tools. Export capabilities may vary depending on account access level."
  },
  {
    q: "How can I collaborate with the OpenPlanet team?",
    a: "Researchers, government agencies, and climate organizations interested in collaboration, data partnerships, or pilot projects can contact the OpenPlanet team through the secure uplink form on this page."
  }
];

export default function SupportPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [openFaq, setOpenFaq] = useState<number | null>(0); // First FAQ open by default

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      // ── CONNECTED TO YOUR FORMSPREE ENDPOINT ──
      const response = await fetch("https://formspree.io/f/xreyberd", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 lg:p-16 font-mono selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* ── HEADER ── */}
        <div className="border-b border-white/10 pb-8">
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-white">
            Support & <span className="text-indigo-400">Intelligence Operations</span>
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-3">
            OpenPlanet Documentation • Partnership Inquiries • Technical Assistance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* ── LEFT COLUMN: KNOWLEDGE BASE (FAQ) ── */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              <h2 className="text-[10px] text-indigo-400 uppercase tracking-[0.3em] font-bold">Knowledge Base (FAQ)</h2>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => (
                <div 
                  key={idx} 
                  className={`border transition-all duration-300 ${openFaq === idx ? 'border-indigo-500/50 bg-white/[0.02]' : 'border-white/5 bg-black/40 hover:border-white/20'}`}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-left px-6 py-5 flex justify-between items-center focus:outline-none"
                  >
                    <span className="text-xs font-bold uppercase tracking-widest pr-4 leading-relaxed">
                      {faq.q}
                    </span>
                    <span className={`text-[10px] text-indigo-400 font-bold transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}>
                      {openFaq === idx ? '[ - ]' : '[ + ]'}
                    </span>
                  </button>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${openFaq === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="px-6 pb-6 text-[11px] text-slate-400 leading-loose tracking-wider border-t border-white/5 pt-4 mt-2">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: SECURE UPLINK FORM ── */}
          <div className="lg:col-span-5">
            <div className="sticky top-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <h2 className="text-[10px] text-emerald-400 uppercase tracking-[0.3em] font-bold">Secure Uplink / Contact</h2>
              </div>

              <div className="bg-black/60 backdrop-blur-xl border border-white/5 p-8 rounded-xl shadow-2xl relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 blur-[120px] pointer-events-none"></div>

                {status === "success" ? (
                  <div className="text-center py-16 animate-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-full mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white mb-3">Transmission Successful</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
                      Your query has been logged in our system. <br/> The OpenPlanet team will respond shortly.
                    </p>
                    <button 
                      onClick={() => setStatus("idle")}
                      className="mt-8 px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded text-[10px] font-bold uppercase tracking-widest"
                    >
                      Initialize New Session
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    
                    {/* Basic Info */}
                    <div className="space-y-2">
                      <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Operator Name *</label>
                      <input type="text" name="name" required className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-inner" placeholder="JOHN DOE" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Return Email *</label>
                      <input type="email" name="email" required className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-inner" placeholder="J.DOE@INSTITUTION.ORG" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Organization / Institution</label>
                      <input type="text" name="organization" className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-inner" placeholder="OPTIONAL" />
                    </div>

                    {/* Category Dropdown */}
                    <div className="space-y-2">
                      <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Request Category *</label>
                      <select name="category" required className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-inner appearance-none cursor-pointer">
                        <option value="" disabled selected>SELECT CLASSIFICATION...</option>
                        <option value="Technical Issue">Technical Issue</option>
                        <option value="Data Question">Data Question</option>
                        <option value="Research Collaboration">Research Collaboration</option>
                        <option value="Feature Request">Feature Request</option>
                        <option value="Partnership Inquiry">Partnership Inquiry</option>
                        <option value="Account / Access Support">Account / Access Support</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Message Area */}
                    <div className="space-y-2 pt-2">
                      <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Diagnostic Message *</label>
                      <textarea
                        name="message"
                        required
                        rows={4}
                        className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-inner custom-scrollbar resize-none leading-relaxed"
                        placeholder="Describe your question or issue in detail. Include the city analyzed, scenario parameters, or specific dataset if relevant."
                      ></textarea>
                    </div>

                    {/* Error State */}
                    {status === "error" && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded px-4 py-3 flex gap-4 items-center animate-pulse">
                        <span className="text-red-500 font-bold text-[10px]">ERR:</span>
                        <span className="text-red-400 text-[9px] uppercase tracking-widest">Transmission failed. Check network.</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="w-full pt-4"
                    >
                      <div className="w-full px-6 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.3em] rounded hover:bg-slate-200 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] text-center">
                        {status === "submitting" ? "ENCRYPTING & TRANSMITTING..." : "SUBMIT REPORT"}
                      </div>
                    </button>

                  </form>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}