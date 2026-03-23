'use client';

import React, { useState } from "react";

const FAQS = [
  {
    q: "What does OpenPlanet actually do?",
    a: "OpenPlanet is a climate risk intelligence platform that provides high-resolution heat projections for any city on Earth. It estimates heat-related mortality, economic losses, and heatwave exposure using peer-reviewed epidemiological models, then lets you model the impact of interventions like urban tree cover and cool roofs."
  },
  {
    q: "Where does OpenPlanet get its climate data?",
    a: "The engine uses ERA5 reanalysis data via the Open-Meteo API for historical baselines (1991–2020), and a 3-model CMIP6 ensemble (MRI-AGCM3-2-S, NICAM16-8S, MPI-ESM1-2-XR) for projections up to 2050. For 2075 and 2100, IPCC AR6 WG1 published regional warming deltas are applied. Population data comes from GeoNames, GDP and mortality rates from the World Bank API."
  },
  {
    q: "Are the projections predictions of the future?",
    a: "No. They are research-grade estimates based on statistical models under specific emissions scenarios (SSP2-4.5 and SSP5-8.5). Mortality estimates carry a ±15% confidence interval and economic estimates carry ±8%. They are directional indicators for planning and analysis — not deterministic forecasts and not investment advice."
  },
  {
    q: "Who is OpenPlanet designed for?",
    a: "OpenPlanet is built for anyone who makes decisions about places — city planners assessing heatwave risk, climate researchers who need auditable projections, investors and risk teams quantifying GDP-at-risk, and curious individuals who want to understand what climate change means for a specific city."
  },
  {
    q: "How accurate are the climate risk models?",
    a: "The mortality model follows Gasparrini et al. (2017) published in Lancet Planetary Health (β = 0.0801). The economic model follows Burke et al. (2018) in Nature combined with ILO (2019) labor productivity data. Wet-bulb temperature uses the Stull (2011) empirical formula capped at 35°C per Sherwood & Huber (2010). All constants are documented and traceable. Post-2050 projections use IPCC AR6 regional deltas, not direct CMIP6 output — this is disclosed throughout."
  },
  {
    q: "Can I export or download the data?",
    a: "Yes. Every city analysis includes a full Excel export — a 4-sheet audit model with a plain-language README, an editable Control Panel where you can change any input and watch outputs recalculate instantly, a Core Engine sheet with the complete peer-reviewed mathematics, and a Constants & Provenance sheet with full citations. The file is compatible with both Microsoft Excel and Google Sheets."
  },
  {
    q: "How can I collaborate or give feedback?",
    a: "If you have feedback, found a bug, or want to suggest a new feature, we'd love to hear from you. Just drop us a message using the contact form on this page."
  }
];

export default function SupportPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
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
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 lg:p-16 font-mono selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* ── HEADER ── */}
        <div className="border-b border-white/10 pb-8 mt-12">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.2em] text-white">
            FAQ & <span className="text-cyan-400">Support</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* ── LEFT COLUMN: KNOWLEDGE BASE (FAQ) ── */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
              <h2 className="text-[11px] text-cyan-400 uppercase tracking-[0.3em] font-bold">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div 
                  key={idx} 
                  className={`border rounded-lg transition-all duration-300 overflow-hidden ${openFaq === idx ? 'border-cyan-500/50 bg-cyan-950/10 shadow-[0_0_20px_rgba(34,211,238,0.05)]' : 'border-white/5 bg-black/40 hover:border-white/20'}`}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-left px-6 py-5 flex justify-between items-center focus:outline-none"
                  >
                    <span className={`text-xs uppercase tracking-widest pr-4 leading-relaxed ${openFaq === idx ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
                      {faq.q}
                    </span>
                    <span className={`text-xl text-cyan-500 font-light transition-transform duration-300 ${openFaq === idx ? 'rotate-45 text-cyan-300' : ''}`}>
                      +
                    </span>
                  </button>
                  
                  <div 
                    className={`transition-all duration-500 ease-in-out ${openFaq === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="px-6 pb-6 text-xs text-slate-400 leading-loose tracking-wide border-t border-white/5 pt-4 mt-1">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: SECURE UPLINK FORM ── */}
          <div className="lg:col-span-5">
            <div className="sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <h2 className="text-[11px] text-emerald-400 uppercase tracking-[0.3em] font-bold">Contact Us</h2>
              </div>

              <div className="bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/10 blur-[100px] pointer-events-none"></div>

                {status === "success" ? (
                  <div className="text-center py-16 animate-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-full mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white mb-3">Message Sent!</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
                      Thanks for reaching out. <br/> We'll get back to you as soon as possible.
                    </p>
                    <button 
                      onClick={() => setStatus("idle")}
                      className="mt-8 px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-[10px] font-bold uppercase tracking-widest"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Name *</label>
                      <input type="text" name="name" required className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3.5 text-xs text-white placeholder-slate-600 outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest" placeholder="John Doe" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Email *</label>
                      <input type="email" name="email" required className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3.5 text-xs text-white placeholder-slate-600 outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest" placeholder="john@example.com" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Organization (Optional)</label>
                      <input type="text" name="organization" className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3.5 text-xs text-white placeholder-slate-600 outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest" placeholder="University or Company" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Category *</label>
                      <select name="category" required defaultValue="" className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3.5 text-xs text-white outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest appearance-none cursor-pointer">
                        <option value="" disabled>Select an option...</option>
                        <option value="Feedback / Suggestion">Feedback / Suggestion</option>
                        <option value="Bug Report">Bug Report</option>
                        <option value="Data Question">Data Question</option>
                        <option value="Partnership / Collaboration">Partnership / Collaboration</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Message *</label>
                      <textarea
                        name="message"
                        required
                        rows={4}
                        className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3.5 text-xs text-white placeholder-slate-600 outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest custom-scrollbar resize-none leading-relaxed"
                        placeholder="How can we help you today?"
                      ></textarea>
                    </div>

                    {status === "error" && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex gap-4 items-center">
                        <span className="text-red-500 font-bold text-[10px]">ERR:</span>
                        <span className="text-red-400 text-[10px] uppercase tracking-widest">Message failed to send. Please try again.</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="w-full pt-2"
                    >
                      <div className="w-full px-6 py-4 bg-cyan-900/80 border border-cyan-500/50 text-cyan-100 text-[10px] font-bold uppercase tracking-[0.3em] rounded-lg hover:bg-cyan-800 hover:text-white disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(34,211,238,0.1)] text-center">
                        {status === "submitting" ? "SENDING MESSAGE..." : "SEND MESSAGE"}
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