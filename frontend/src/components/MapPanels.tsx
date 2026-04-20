import React from 'react';
import { Database } from 'lucide-react';
import { getScientificRange, InfoIcon } from './MapHelpers';
import { formatCoordinates } from '@/context/ClimateDataContext';

export const LeftPanel = ({
  selectedCity, searchQuery, setSearchQuery, suggestions, setSuggestions, setSelectedCity,
  year, setYear, ssp, setSsp, handleInitialize, isLoading, isInitialized, canopy, coolRoof, handleMitigationChange, isSimulating
}: any) => {
  return (
    <div className="bg-[#06101f]/95 backdrop-blur-2xl border border-slate-800/70 rounded-2xl p-4 w-[280px] flex flex-col shadow-2xl h-full pointer-events-auto overflow-y-auto custom-scrollbar">
      
      <div className="flex flex-col gap-4">
        {/* LOCATION SEARCH WITH FIX */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center">
            LOCATION <InfoIcon text="Search global city for CMIP6 downscaled data" />
          </label>
          <div className="relative">
            <input 
              type="text" placeholder="Search city..." value={searchQuery} 
              // ✅ FIX 1: Added setSelectedCity(null) here so typing unlocks the city and shows suggestions!
              onChange={(e) => { 
                setSearchQuery(e.target.value); 
                if (selectedCity) setSelectedCity(null); 
              }} 
              className="w-full bg-[#0a1830] border border-slate-700 rounded-xl px-3 py-2 text-[12px] text-slate-200 outline-none focus:border-cyan-500/50" 
            />
            {/* ✅ FIX 2: Added absolute positioning back so it drops down properly */}
            {suggestions.length > 0 && !selectedCity && (
              <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0a1830] border border-slate-700/50 rounded-xl overflow-hidden z-[9999] shadow-2xl">
                {suggestions.map((city: any, idx: number) => (
                  <div key={`${city.id}-${idx}`} onClick={() => { setSelectedCity({ name: city.name, lat: city.latitude, lng: city.longitude }); setSearchQuery(`${city.name}${city.country ? ', ' + city.country : ''}`); setSuggestions([]); }} className="px-3 py-2.5 text-[11px] text-slate-300 hover:bg-cyan-900/30 cursor-pointer border-b border-slate-800/40 last:border-0">
                    {city.name} {city.country && <span className="text-slate-600 ml-1">{city.country}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedCity && <p className="text-[9px] font-mono text-slate-500 italic pl-0.5">{formatCoordinates(selectedCity.lat, selectedCity.lng)}</p>}
        </div>

        {/* LINE BY LINE SELECTS */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center">
              Target Year <InfoIcon text="Projection timeline for predictive models" />
            </label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-[#0a1830] border border-slate-700 rounded-xl px-3 py-2 text-[11px] text-slate-200 cursor-pointer">
              <option value="2030">2030</option>
              <option value="2050">2050 – Mid-century</option>
              <option value="2070">2070</option>
              <option value="2100">2100</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center">
              Emission Scenario <InfoIcon text="SSP Pathways: Defines socio-economic global warming assumptions" />
            </label>
            <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-[#0a1830] border border-slate-700 rounded-xl px-3 py-2 text-[11px] text-slate-200 cursor-pointer">
              <option value="SSP2-4.5">SSP2-4.5 – Moderate</option>
              <option value="SSP5-8.5">SSP5-8.5 – High</option>
            </select>
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <button onClick={handleInitialize} disabled={!selectedCity || isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-[11px] font-mono text-white font-bold uppercase tracking-widest shadow-lg hover:brightness-110 transition-all disabled:opacity-30">
          {isLoading ? 'ANALYZING...' : 'GENERATE PROJECTION →'}
        </button>
      </div>

      {/* SIMULATOR AREA */}
      {isInitialized && (
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3">
          <div>
            <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center uppercase tracking-widest">
              Theoretical Simulator <InfoIcon text="Adjust sliders to observe generalized cooling impacts" />
            </div>
            <p className="text-[8.5px] text-slate-500 leading-tight italic">
              Note: This is a visualization tool to understand mitigation scaling. Data displayed is for directional guidance only.
            </p>
          </div>

          <div className="space-y-4 bg-[#0a1830]/50 p-3 rounded-xl border border-slate-800/50">
            <div className="space-y-2">
              <div className="flex justify-between"><label className="text-[9px] text-slate-400 uppercase">Canopy Expansion</label><span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span></div>
              <input type="range" min="0" max="50" value={canopy} onChange={(e) => handleMitigationChange('canopy', Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><label className="text-[9px] text-slate-400 uppercase">Albedo Roofs</label><span className="text-[10px] font-mono text-cyan-400">+{coolRoof}%</span></div>
              <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => handleMitigationChange('coolRoof', Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-full appearance-none accent-cyan-500 cursor-pointer" />
            </div>
          </div>

          <div className="p-2.5 bg-amber-950/20 border border-amber-900/30 rounded-lg mt-auto">
            <p className="text-[7.5px] text-amber-500 leading-tight uppercase font-bold mb-1">⚠️ Legal / Scientific Note</p>
            <p className="text-[7.5px] text-slate-400 leading-relaxed italic">
              In highly humid coastal biomes (e.g., Mumbai, Chennai), excessive canopy expansion may theoretically trap surface-level humidity, potentially exacerbating lethal Wet-Bulb temperatures.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const RightPanel = ({ isInitialized, simData, isSimulating, mitigatedData, openAudit }: any) => {
  return (
    <div className="bg-[#06101f]/95 backdrop-blur-2xl border border-slate-800/70 rounded-2xl p-0 w-[280px] flex flex-col shadow-2xl h-full pointer-events-auto overflow-hidden">
      <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest p-3.5 border-b border-slate-800 flex justify-between bg-slate-900/30 shrink-0">
        Risk Metrics {isInitialized && <span className="text-emerald-500 animate-pulse">● LIVE</span>}
      </div>
      
      {!isInitialized ? (
        <div className="flex-grow flex items-center justify-center text-slate-700 text-[10px] font-mono tracking-widest uppercase">Select Location</div>
      ) : (
        <div className="flex flex-col flex-grow overflow-y-auto custom-scrollbar bg-[#0a1830]/80">
          
          {/* SERIAL BOX 1: DEATHS */}
          <div className="p-4 border-b border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
              Attributable Deaths <InfoIcon text="Fatality estimation. 95% Confidence Interval based on Beta = 0.0801" />
            </div>
            
            <div className="mt-1">
              {isSimulating ? (
                 <div className="flex flex-col">
                   <p className="text-[11px] font-mono text-slate-500 mb-0.5">{simData?.deaths || '--'} (Baseline)</p>
                   <p className="text-[28px] font-mono text-emerald-400 font-bold leading-none">↓ {mitigatedData?.deaths || '--'}</p>
                 </div>
              ) : (
                 <p className="text-[28px] font-mono text-red-500 leading-none">{simData?.deaths || '--'}</p>
              )}
            </div>

            <p className="text-[8px] font-mono text-slate-500 mt-1">95% CI · {getScientificRange(simData?.deaths || '--', 'num')}</p>
            
            {isSimulating && mitigatedData && (
              <div className="pt-2 mt-2 border-t border-slate-800/50 flex justify-start">
                <span className="text-[9px] font-mono text-emerald-500/80 bg-emerald-950/30 px-2 py-1 rounded">SAVED: {mitigatedData.savedDeaths || '0'}</span>
              </div>
            )}
            
            <button onClick={() => openAudit('mortality')} className="mt-3 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800/40 border border-slate-700 rounded-lg text-[8px] font-mono text-slate-500 hover:text-white transition-all uppercase tracking-tighter"><Database size={10}/> CALCULATION LOG (IPCC AR6)</button>
          </div>

          {/* SERIAL BOX 2: ECONOMIC */}
          <div className="p-4 border-b border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
              Economic Impact <InfoIcon text="GDP/Productivity loss estimation due to heat stress" />
            </div>
            
            <div className="mt-1">
              {isSimulating ? (
                 <div className="flex flex-col">
                   <p className="text-[11px] font-mono text-slate-500 mb-0.5">{simData?.loss || '--'} (Baseline)</p>
                   <p className="text-[24px] font-mono text-emerald-400 font-bold leading-none">↓ {mitigatedData?.loss || '--'}</p>
                 </div>
              ) : (
                 <p className="text-[24px] font-mono text-amber-500 leading-none">{simData?.loss || '--'}</p>
              )}
            </div>

            <p className="text-[8px] font-mono text-slate-500 mt-1">RANGE · {getScientificRange(simData?.loss || '--', 'num')}</p>
            
            {isSimulating && mitigatedData && (
              <div className="pt-2 mt-2 border-t border-slate-800/50 flex justify-start">
                <span className="text-[9px] font-mono text-emerald-500/80 bg-emerald-950/30 px-2 py-1 rounded">SAVED: {mitigatedData.savedLoss || '0'}</span>
              </div>
            )}

            <button onClick={() => openAudit('economics')} className="mt-3 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800/40 border border-slate-700 rounded-lg text-[8px] font-mono text-slate-500 hover:text-white transition-all uppercase tracking-tighter"><Database size={10}/> CALCULATION LOG (BURKE 2018)</button>
          </div>

          {/* SERIAL BOX 3: HEATWAVE & TEMP */}
          <div className="p-4 flex flex-col gap-4">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center">Heatwaves <InfoIcon text="Annual count of days exceeding historical P95" /></span>
              {isSimulating ? (
                 <div className="mt-1">
                   <span className="text-[10px] font-mono text-slate-500 mr-2">{simData?.heatwave || '--'}d</span>
                   <span className="text-xl text-emerald-400 font-mono font-bold leading-none">↓ {mitigatedData?.heatwave || '--'}d</span>
                 </div>
              ) : (
                 <p className="text-xl font-mono text-red-500 leading-none mt-1">{simData?.heatwave || '--'}d</p>
              )}
              <p className="text-[8px] font-mono text-slate-500 mt-1">RANGE · {getScientificRange(simData?.heatwave || '--', 'days')}</p>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center">Peak Tx5d <InfoIcon text="Hottest continuous 5-day mean temperature" /></span>
              {isSimulating ? (
                 <div className="mt-1">
                   <span className="text-[10px] font-mono text-slate-500 mr-2">{simData?.temp || '--'}°C</span>
                   <span className="text-xl text-emerald-400 font-mono font-bold leading-none">↓ {mitigatedData?.temp || '--'}°C</span>
                 </div>
              ) : (
                 <p className="text-xl font-mono text-red-500 leading-none mt-1">{simData?.temp || '--'}°C</p>
              )}
              <p className="text-[8px] font-mono text-slate-500 mt-1">RANGE · {getScientificRange(simData?.temp || '--', 'temp')}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};