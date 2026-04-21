import React from 'react';
import { Database } from 'lucide-react';
import { getScientificRange } from './MapHelpers';
import { formatCoordinates } from '@/context/ClimateDataContext';

/* ─── Shared sub-components ─── */
const MetricRow = ({
  label, value, sub, color,
  isSimulating, baseValue, unit = '',
}: {
  label: string; value: string; sub: string; color: string;
  isSimulating?: boolean; baseValue?: string; unit?: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center">
        {label}
      </span>
    </div>
    {isSimulating && baseValue ? (
      <div className="space-y-0.5">
        <p className="text-[10px] font-mono text-slate-600 tabular-nums">{baseValue}{unit} <span className="text-slate-700">baseline</span></p>
        <p className={`text-[22px] font-mono font-bold leading-none tabular-nums text-emerald-400`}>
          ↓ {value}{unit}
        </p>
      </div>
    ) : (
      <p className={`text-[26px] font-mono font-bold leading-none tabular-nums ${color}`}>{value}{unit}</p>
    )}
    <p className="text-[8px] font-mono text-slate-600">{sub}</p>
  </div>
);

const SavedBadge = ({ value }: { value: string }) => (
  <div className="inline-flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-900/30 rounded-lg px-2.5 py-1.5">
    <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]" />
    <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Saved {value}</span>
  </div>
);

const AuditButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-[8px] font-mono text-slate-600 hover:text-cyan-400 hover:border-cyan-900/50 hover:bg-cyan-950/20 transition-all duration-200 uppercase tracking-wider group"
  >
    <Database size={9} className="group-hover:text-cyan-400 transition-colors" />
    {label}
  </button>
);

/* ─── LEFT PANEL ─── */
export const LeftPanel = ({
  selectedCity, searchQuery, setSearchQuery, suggestions, setSuggestions, setSelectedCity,
  year, setYear, ssp, setSsp, handleInitialize, isLoading, isInitialized,
  canopy, coolRoof, handleMitigationChange, isSimulating,
}: any) => {
  return (
    <div className="bg-[#060f1e]/98 backdrop-blur-2xl border border-slate-800/60 rounded-2xl p-4 w-full md:w-[272px] md:min-w-[272px] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)] h-full pointer-events-auto overflow-y-auto custom-scrollbar">
      {/* Panel header */}
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-800/60">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-[0.25em] font-bold">Climate Engine</span>
        <div className="ml-auto">
          <span className="text-[7px] font-mono text-slate-700 uppercase tracking-widest">CMIP6</span>
        </div>
      </div>
      <div className="flex flex-col gap-5 flex-1">
        
        {/* LOCATION SEARCH */}
        <div className="space-y-2">
          <label className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] font-bold flex items-center">
            Location
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
              className="w-full bg-[#0a1828] border border-slate-800 focus:border-cyan-700/60 rounded-xl pl-8 pr-3 py-2.5 text-[11px] text-slate-200 outline-none transition-colors duration-200 placeholder:text-slate-700"
            />
            {suggestions.length > 0 && !selectedCity && (
              <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0a1828] border border-slate-700/50 rounded-xl overflow-hidden z-[9999] shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                {suggestions.map((city: any, idx: number) => (
                  <div
                    key={`${city.id}-${idx}`}
                    onClick={() => {
                      setSelectedCity({ name: city.name, lat: city.latitude, lng: city.longitude });
                      setSearchQuery(`${city.name}${city.country ? ', ' + city.country : ''}`);
                      setSuggestions([]);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-slate-300 hover:bg-cyan-950/30 hover:text-white cursor-pointer border-b border-slate-800/40 last:border-0 transition-colors duration-150"
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                    <span>{city.name}</span>
                    {city.country && <span className="text-slate-600 text-[10px] ml-auto">{city.country}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedCity && (
            <div className="flex items-center gap-1.5 pl-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
              <p className="text-[8px] font-mono text-slate-600 italic">{formatCoordinates(selectedCity.lat, selectedCity.lng)}</p>
            </div>
          )}
        </div>

        {/* SELECTS */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] font-bold flex items-center">
              Target Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-[#0a1828] border border-slate-800 focus:border-cyan-700/60 rounded-xl px-3 py-2.5 text-[11px] text-slate-300 cursor-pointer outline-none transition-colors duration-200 appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="2030">2030</option>
              <option value="2050">2050 – Mid-century</option>
              <option value="2070">2070</option>
              <option value="2100">2100</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] font-bold flex items-center">
              Emission Scenario
            </label>
            <select
              value={ssp}
              onChange={(e) => setSsp(e.target.value)}
              className="w-full bg-[#0a1828] border border-slate-800 focus:border-cyan-700/60 rounded-xl px-3 py-2.5 text-[11px] text-slate-300 cursor-pointer outline-none transition-colors duration-200 appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="SSP2-4.5">SSP2-4.5 – Moderate</option>
              <option value="SSP5-8.5">SSP5-8.5 – High</option>
            </select>
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <button
          onClick={handleInitialize}
          disabled={!selectedCity || isLoading}
          className="relative w-full py-3 rounded-xl text-[10px] font-mono text-white font-bold uppercase tracking-[0.2em] shadow-lg transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0891b2, #059669)' }}
        >
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-200" />
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Generate Projection
              <span className="text-white/60">→</span>
            </span>
          )}
        </button>

        {/* SIMULATOR */}
        {isInitialized && (
          <div className="pt-4 border-t border-slate-800/60 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-[0.15em] flex items-center">
                  Theoretical Simulator
                </span>
              </div>
              <p className="text-[8px] text-slate-600 leading-relaxed italic pl-3.5">
                Visualization tool for directional guidance only.
              </p>
            </div>
            
            <div className="space-y-4 bg-[#0a1828]/60 p-4 rounded-xl border border-slate-800/40">
              {/* Canopy */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                    Canopy Expansion
                  </label>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold tabular-nums">+{canopy}%</span>
                </div>
                <div className="relative">
                  <input
                    type="range" min="0" max="50" value={canopy}
                    onChange={(e) => handleMitigationChange('canopy', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div
                    className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-full pointer-events-none"
                    style={{ width: `${(canopy / 50) * 100}%` }}
                  />
                </div>
              </div>
              {/* Albedo */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                    Albedo Roofs
                  </label>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold tabular-nums">+{coolRoof}%</span>
                </div>
                <div className="relative">
                  <input
                    type="range" min="0" max="100" value={coolRoof}
                    onChange={(e) => handleMitigationChange('coolRoof', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div
                    className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-cyan-700 to-cyan-400 rounded-full pointer-events-none"
                    style={{ width: `${(coolRoof / 100) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Legal note */}
            <div className="p-3 bg-amber-950/15 border border-amber-900/25 rounded-xl">
              <p className="text-[7px] text-amber-500/70 leading-tight uppercase font-bold mb-1 flex items-center gap-1">
                <span>⚠</span> Scientific Note
              </p>
              <p className="text-[8px] text-slate-500 leading-relaxed italic">
                In highly humid coastal biomes (e.g., Mumbai, Chennai), excessive canopy expansion may theoretically trap surface-level humidity, potentially exacerbating lethal Wet-Bulb temperatures.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── RIGHT PANEL ─── */
export const RightPanel = ({ isInitialized, simData, isSimulating, mitigatedData, openAudit }: any) => {
  return (
    <div className="bg-[#060f1e]/98 backdrop-blur-2xl border border-slate-800/60 rounded-2xl w-full md:w-[272px] md:min-w-[272px] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.6)] h-full pointer-events-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/60 bg-slate-900/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.25em] font-bold">Risk Metrics</span>
        </div>
        {isInitialized && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
            <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      {!isInitialized ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3 px-6">
          <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest text-center">Select Location<br />to Generate</p>
        </div>
      ) : (
        <div className="flex flex-col flex-grow overflow-y-auto custom-scrollbar divide-y divide-slate-800/40">
          
          {/* ── DEATHS ── */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center">
                Attributable Deaths
              </span>
            </div>
            <div>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-600">{simData?.deaths || '--'} <span className="text-slate-700 text-[8px]">baseline</span></p>
                  <p className="text-[26px] font-mono font-bold leading-none text-emerald-400">↓ {mitigatedData?.deaths || '--'}</p>
                </div>
              ) : (
                <p className="text-[30px] font-mono font-bold leading-none text-red-400 tabular-nums">{simData?.deaths || '--'}</p>
              )}
            </div>
            <p className="text-[8px] font-mono text-slate-600 leading-relaxed">
              95% CI · {getScientificRange(simData?.deaths || '--', 'num')}
            </p>
            {isSimulating && mitigatedData && <SavedBadge value={mitigatedData.savedDeaths || '0'} />}
            <AuditButton label="Calculation Log · IPCC AR6" onClick={() => openAudit('mortality')} />
          </div>

          {/* ── ECONOMIC ── */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center">
                Economic Impact
              </span>
            </div>
            <div>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-600">{simData?.loss || '--'} <span className="text-slate-700 text-[8px]">baseline</span></p>
                  <p className="text-[22px] font-mono font-bold leading-none text-emerald-400">↓ {mitigatedData?.loss || '--'}</p>
                </div>
              ) : (
                <p className="text-[26px] font-mono font-bold leading-none text-amber-400 tabular-nums">{simData?.loss || '--'}</p>
              )}
            </div>
            <p className="text-[8px] font-mono text-slate-600">
              Range · {getScientificRange(simData?.loss || '--', 'num')}
            </p>
            {isSimulating && mitigatedData && <SavedBadge value={mitigatedData.savedLoss || '0'} />}
            <AuditButton label="Calculation Log · Burke 2018" onClick={() => openAudit('economics')} />
          </div>

          {/* ── HEATWAVE + TEMP ── */}
          <div className="p-4 space-y-4">
            {/* Heatwave Days */}
            <div className="space-y-2">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center">
                Heatwave Days
              </span>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-600">{simData?.heatwave || '--'}d <span className="text-slate-700 text-[8px]">baseline</span></p>
                  <p className="text-[22px] font-mono font-bold leading-none text-emerald-400">↓ {mitigatedData?.heatwave || '--'}d</p>
                </div>
              ) : (
                <p className="text-[24px] font-mono font-bold leading-none text-red-400 tabular-nums">{simData?.heatwave || '--'}d</p>
              )}
              <p className="text-[8px] font-mono text-slate-600">Range · {getScientificRange(simData?.heatwave || '--', 'days')}</p>
            </div>

            {/* Peak Temp */}
            <div className="space-y-2 pt-4 border-t border-slate-800/40">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center">
                Peak Tx5d
              </span>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-600">{simData?.temp || '--'}°C <span className="text-slate-700 text-[8px]">baseline</span></p>
                  <p className="text-[22px] font-mono font-bold leading-none text-emerald-400">↓ {mitigatedData?.temp || '--'}°C</p>
                </div>
              ) : (
                <p className="text-[24px] font-mono font-bold leading-none text-red-400 tabular-nums">{simData?.temp || '--'}°C</p>
              )}
              <p className="text-[8px] font-mono text-slate-600">Range · {getScientificRange(simData?.temp || '--', 'temp')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};