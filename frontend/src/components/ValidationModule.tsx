'use client';

import { useState } from "react";

// ── TYPES ────────────────────────────────────────────────────────────────────
interface ValidationCity {
  name: string;
  lat: number;
  lng: number;
  elevation: number;
  expected_range: [number, number];
  climate_note: string;
}

interface ValidationResult {
  city: string;
  lat: number;
  lng: number;
  elevation: number;
  era5_threshold: number | null;
  expected_range: [number, number];
  status: "pass" | "fail" | "warn" | "loading" | "error";
  note: string;
  error?: string;
}

// ── VALIDATION DATASET ───────────────────────────────────────────────────────
// Representative validation set — known scientific expected ranges
const VALIDATION_CITIES: ValidationCity[] = [
  { name: "London, UK",           lat: 51.51,  lng: -0.13,  elevation: 11,   expected_range: [24, 30], climate_note: "Maritime temperate — low threshold" },
  { name: "Riyadh, Saudi Arabia", lat: 24.69,  lng: 46.72,  elevation: 612,  expected_range: [38, 45], climate_note: "Arabian desert — extreme threshold" },
  { name: "Mumbai, India",        lat: 19.07,  lng: 72.87,  elevation: 14,   expected_range: [32, 38], climate_note: "Tropical coastal — high humidity" },
  { name: "Quito, Ecuador",       lat: -0.22,  lng: -78.51, elevation: 2850, expected_range: [16, 22], climate_note: "High-altitude equatorial — cool" },
  { name: "Sydney, Australia",    lat: -33.87, lng: 151.21, elevation: 25,   expected_range: [28, 34], climate_note: "Southern maritime temperate" },
  { name: "Phoenix, AZ, USA",     lat: 33.45,  lng: -112.07,elevation: 331,  expected_range: [38, 44], climate_note: "Sonoran Desert — extreme summer heat" },
  { name: "Oslo, Norway",         lat: 59.91,  lng: 10.75,  elevation: 23,   expected_range: [22, 28], climate_note: "Scandinavian maritime" },
  { name: "Singapore",            lat: 1.35,   lng: 103.82, elevation: 8,    expected_range: [32, 36], climate_note: "Equatorial maritime — humid" },
  { name: "Nairobi, Kenya",       lat: -1.29,  lng: 36.82,  elevation: 1795, expected_range: [24, 30], climate_note: "East African highland — cooler equatorial" },
  { name: "Dubai, UAE",           lat: 25.20,  lng: 55.27,  elevation: 5,    expected_range: [40, 46], climate_note: "Arabian coastal desert" },
  { name: "Reykjavik, Iceland",   lat: 64.13,  lng: -21.95, elevation: 50,   expected_range: [16, 22], climate_note: "Sub-arctic maritime" },
  { name: "Delhi, India",         lat: 28.61,  lng: 77.21,  elevation: 216,  expected_range: [36, 43], climate_note: "Gangetic Plain — semi-arid summer" },
];

// ── LOGIC ────────────────────────────────────────────────────────────────────
function classify(
  threshold: number,
  range: [number, number]
): "pass" | "warn" | "fail" {
  const [lo, hi] = range;
  if (threshold >= lo && threshold <= hi) return "pass";
  const margin = (hi - lo) * 0.25;
  if (threshold >= lo - margin && threshold <= hi + margin) return "warn";
  return "fail";
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ValidationModule() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const runValidation = async () => {
    setRunning(true);
    setDone(false);

    // Initialise all as loading
    setResults(
      VALIDATION_CITIES.map((c) => ({
        city: c.name, lat: c.lat, lng: c.lng, elevation: c.elevation,
        era5_threshold: null, expected_range: c.expected_range,
        status: "loading", note: c.climate_note,
      }))
    );

    // Fetch one at a time to avoid hammering ERA5
    for (let i = 0; i < VALIDATION_CITIES.length; i++) {
      const c = VALIDATION_CITIES[i];
      try {
        const resp = await fetch("http://127.0.0.1:8000/api/era5-threshold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: c.lat, lng: c.lng }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const threshold: number = data.threshold_c;
        const status = classify(threshold, c.expected_range);

        setResults((prev) => {
          const n = [...prev];
          n[i] = { ...n[i], era5_threshold: threshold, status };
          return n;
        });
      } catch (err: any) {
        setResults((prev) => {
          const n = [...prev];
          n[i] = { ...n[i], status: "error", error: String(err.message) };
          return n;
        });
      }
    }

    setRunning(false);
    setDone(true);
  };

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errored = results.filter((r) => r.status === "error").length;
  const total   = results.filter((r) => r.status !== "loading").length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* ── DIAGNOSTIC HEADER ── */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 rounded-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/5 blur-[100px] pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <h2 className="text-[10px] font-mono font-bold text-white uppercase tracking-[0.4em] mb-4">
              Core Engine Validation Suite
            </h2>
            <p className="text-xs font-mono text-slate-500 leading-relaxed uppercase tracking-wider">
              Benchmarking live ERA5 p95 thresholds against peer-reviewed historical distributions. 
              
              Objective: Verify spatial indexing accuracy across divergent climate zones.
            </p>
          </div>
          <button
            onClick={runValidation}
            disabled={running}
            className="px-10 py-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-[0.2em] rounded hover:bg-slate-200 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {running ? "EXECUTING..." : done ? "RE-INITIALIZE" : "RUN DIAGNOSTIC"}
          </button>
        </div>

        {/* Tactical Summary HUD */}
        {done && total > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-8">
            {[
              { label: "Valid", count: passed, color: "text-emerald-400" },
              { label: "Marginal", count: warned, color: "text-amber-400" },
              { label: "Variance", count: failed, color: "text-red-400" },
              { label: "Pass Rate", count: `${((passed / total) * 100).toFixed(0)}%`, color: "text-white" },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.02] border border-white/5 p-4 rounded">
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-xl font-mono font-bold ${s.color}`}>{s.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── VALIDATION LOG ── */}
      {results.length > 0 && (
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-[10px] font-mono text-white uppercase tracking-[0.4em]">Spatial Accuracy Log</h3>
            <div className="flex gap-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">Real-Time Ingestion</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono">
              <thead>
                <tr className="bg-white/[0.03] text-[9px] text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-8 py-4">Geospatial Sector</th>
                  <th className="px-8 py-4 text-center">Observed ERA5</th>
                  <th className="px-8 py-4 text-center">Expected Range</th>
                  <th className="px-8 py-4">Diagnostic Status</th>
                  <th className="px-8 py-4 text-right">Dev. Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((r) => (
                  <tr key={r.city} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-4">
                      <div className="text-xs font-bold text-white uppercase tracking-wider">{r.city}</div>
                      <div className="text-[9px] text-slate-600 mt-1">{r.lat}N / {r.lng}E</div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className={`text-sm font-bold ${
                        r.status === 'pass' ? 'text-emerald-400' : 
                        r.status === 'warn' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {r.era5_threshold != null ? `${r.era5_threshold.toFixed(1)}°C` : "PENDING..."}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-center text-xs text-slate-500">
                      {r.expected_range[0]} – {r.expected_range[1]}°C
                    </td>
                    <td className="px-8 py-4">
                       {r.status === 'loading' ? (
                         <div className="flex gap-1 items-center">
                            <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                         </div>
                       ) : (
                         <span className={`text-[9px] border px-2 py-1 rounded-sm uppercase tracking-widest ${
                            r.status === 'pass' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' :
                            r.status === 'warn' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' :
                            'border-red-500/20 text-red-500 bg-red-500/5'
                         }`}>
                           {r.status === 'pass' ? 'verified' : r.status === 'warn' ? 'marginal' : 'variance_detected'}
                         </span>
                       )}
                    </td>
                    <td className="px-8 py-4 text-right text-[9px] text-slate-600 uppercase italic">
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}