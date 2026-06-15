import React from 'react';
import { fmtLoss } from './MapHelpers';
import { formatCoordinates, useClimateData } from '@/context/ClimateDataContext';

export interface SuggestionCity {
  id:          string | number;
  name:        string;
  country:     string;
  latitude:    number;
  longitude:   number;
  display_name?: string;
}

export interface PanelSelectedCity {
  locationQuery: string;
  name?:         string;
  country?:      string;
  lat?:          number;
  lng?:          number;
  latitude?:     number;
  longitude?:    number;
}

export interface MitigatedData {
  temp:           string;
  tempDelta:      string;
  wbt:            string;
  wbtDelta:       string;
  heatwave:       string;
  hwDelta:        string;
  deaths:         string;
  savedDeaths:    string;
  savedDeathsNum: number;
  loss:           string;
  savedLoss:      string;
  savedLossNum:   number;
}

interface LeftPanelProps {
  selectedCity:          PanelSelectedCity | null;
  searchQuery:           string;
  setSearchQuery:        (v: string) => void;
  suggestions:           SuggestionCity[];
  setSuggestions:        (v: SuggestionCity[]) => void;
  setSelectedCity:       (v: PanelSelectedCity | null) => void;
  year:                  string;
  setYear:               (v: string) => void;
  ssp:                   string;
  setSsp:                (v: string) => void;
  handleInitialize:      () => void;
  isLoading:             boolean;
  isInitialized:         boolean;
  canGenerate:           boolean;
  canopy:                number;
  coolRoof:              number;
  handleMitigationChange:(type: 'canopy' | 'coolRoof', value: number) => void;
  isSimulating:          boolean;
}

/* ─── Confidence badge ─── */
const ConfidenceBadge = ({
  level, note,
}: {
  level: 'high' | 'medium' | 'low';
  note?: string;
}) => {
  const cfg = {
    high:   { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'High confidence' },
    medium: { dot: 'bg-amber-400',   text: 'text-amber-400',   label: 'Medium confidence' },
    low:    { dot: 'bg-red-400',     text: 'text-red-400',     label: 'Low confidence'    },
  }[level];
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-px ${cfg.dot}`} />
      <div>
        <span className={`font-mono text-[7px] uppercase tracking-widest font-bold ${cfg.text}`}>{cfg.label}</span>
        {note && <p className={`font-mono text-[7px] leading-snug mt-0.5 ${cfg.text} opacity-70`}>{note}</p>}
      </div>
    </div>
  );
};

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
  <div className="inline-flex items-center gap-1.5 bg-[var(--raised)] px-2.5 py-1.5" style={{ border: '1px solid var(--hairline)' }}>
    <div className="w-1 h-1 rounded-full" style={{ background: 'var(--positive)' }} />
    <span className="text-[8px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--positive)' }}>Saved {value}</span>
  </div>
);

const AuditButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full mt-2 flex items-center gap-1.5 py-1.5 font-mono transition-colors duration-150 uppercase"
    style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}
    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
  >
    {label}
  </button>
);

/* ─── LEFT PANEL ─── */
export const LeftPanel = ({
  selectedCity, searchQuery, setSearchQuery, suggestions, setSuggestions, setSelectedCity,
  year, setYear, ssp, setSsp, handleInitialize, isLoading, isInitialized, canGenerate,
  canopy, coolRoof, handleMitigationChange, isSimulating,
}: LeftPanelProps) => {
  return (
    /* Mobile: order-last so map renders above; bounded to 75vh so sliders are visible
       without scrolling the page. Desktop: fixed-width sidebar, full panel height. */
    <div className="w-full md:w-[272px] md:min-w-[272px] flex flex-col md:h-full
                    overflow-y-auto custom-scrollbar pointer-events-auto"
         style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 md:px-5 py-3 md:py-4 shrink-0 border-b" style={{ borderColor: 'var(--hairline)' }}>
        <div className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }} />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--muted)' }}>
          Projection Controls
        </span>
      </div>
      <div className="flex flex-col gap-3 md:gap-5 flex-1 p-4 pb-6 md:p-5 md:pb-5">

        {/* LOCATION SEARCH */}
        <div className="space-y-2">
          <label className="text-[8px] font-mono uppercase tracking-[0.2em] font-bold flex items-center" style={{ color: 'var(--muted)' }}>
            Location
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
              className="w-full pl-9 pr-3 text-[11px] outline-none transition-all duration-200 placeholder:opacity-30 rounded-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hairline)',
                color: 'var(--text)',
                height: '40px',
                padding: '0 12px 0 36px',
              }}
            />
            {suggestions.length > 0 && !selectedCity && (
              <div className="absolute top-full left-0 w-full mt-1.5 bg-black border border-white/[0.05] overflow-hidden z-[9999] shadow-2xl">
                {suggestions.map((city, idx) => {
                  const label = [city.name, city.country].filter(Boolean).join(', ');
                  return (
                    <div
                      key={`${city.id}-${idx}`}
                      onClick={() => {
                        setSelectedCity({
                          locationQuery: label,
                          name:          city.name,
                          country:       city.country,
                          lat:           city.latitude,
                          lng:           city.longitude,
                        });
                        setSearchQuery(label);
                        setSuggestions([]);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-slate-300 hover:bg-white/[0.05] hover:text-white cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors duration-150"
                    >
                      <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                      <span className="truncate">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {selectedCity && (
            <div className="flex items-center gap-1.5 pl-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
              <p className="text-[8px] font-mono text-slate-600 italic">{formatCoordinates(selectedCity.lat ?? 0, selectedCity.lng ?? 0)}</p>
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
              className="w-full px-3 text-[11px] cursor-pointer outline-none transition-all duration-200 appearance-none rounded-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hairline)',
                color: 'var(--text)',
                height: '40px',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2352525B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              <option value="2030">2030 – Near-term</option>
              <option value="2050">2050 – Mid-century</option>
              <option value="2070" disabled className="text-slate-600">2070 – Extended horizon (premium)</option>
              <option value="2100" disabled className="text-slate-600">2100 – Extended horizon (premium)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] font-bold flex items-center">
              Emission Scenario
            </label>
            <select
              value={ssp}
              onChange={(e) => setSsp(e.target.value)}
              className="w-full px-3 text-[11px] cursor-pointer outline-none transition-all duration-200 appearance-none rounded-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hairline)',
                color: 'var(--text)',
                height: '40px',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2352525B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              <option value="SSP2-4.5">SSP2-4.5 – Moderate</option>
              <option value="SSP5-8.5">SSP5-8.5 – High</option>
            </select>
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <button
          onClick={handleInitialize}
          disabled={!canGenerate || isLoading}
          className="btn-primary relative w-full text-[11px] font-sans font-semibold uppercase tracking-wider transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed overflow-hidden"
          style={{ background: 'var(--text)', color: 'var(--canvas)', minHeight: '40px', touchAction: 'manipulation' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#ffffff'; }}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--text)')}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Run projection
              <span className="opacity-60">→</span>
            </span>
          )}
        </button>

        {/* SIMULATOR */}
        {isInitialized && (
          <div className="pt-3 border-t border-white/[0.05] flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--reference)' }}>
                  Adaptation scenario
                </span>
              </div>
              <p className="text-[8px] leading-relaxed italic" style={{ color: 'var(--muted)' }}>
                Directional visualization only.
              </p>
            </div>

            <div className="flex flex-col gap-3 p-3 border" style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'var(--hairline)' }}>
              {/* Canopy */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] font-mono uppercase tracking-wider font-bold" style={{ color: 'var(--muted)' }}>
                    Canopy
                  </label>
                  <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: 'var(--positive)' }}>+{canopy}%</span>
                </div>
                <div className="relative">
                  <input
                    type="range" min="0" max="50" value={canopy}
                    onChange={(e) => handleMitigationChange('canopy', Number(e.target.value))}
                    className="w-full h-1 bg-white/[0.05] rounded-none appearance-none cursor-pointer accent-emerald-500"
                    style={{ touchAction: 'pan-y' }}
                  />
                  <div
                    className="absolute top-0 left-0 h-1 pointer-events-none"
                    style={{ width: `${(canopy / 50) * 100}%`, background: 'var(--positive)' }}
                  />
                </div>
              </div>
              {/* Albedo */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] font-mono uppercase tracking-wider font-bold" style={{ color: 'var(--muted)' }}>
                    Albedo Roofs
                  </label>
                  <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: 'var(--reference)' }}>+{coolRoof}%</span>
                </div>
                <div className="relative">
                  <input
                    type="range" min="0" max="100" value={coolRoof}
                    onChange={(e) => handleMitigationChange('coolRoof', Number(e.target.value))}
                    className="w-full h-1 bg-white/[0.05] rounded-none appearance-none cursor-pointer accent-cyan-500"
                    style={{ touchAction: 'pan-y' }}
                  />
                  <div
                    className="absolute top-0 left-0 h-1 pointer-events-none"
                    style={{ width: `${(coolRoof / 100) * 100}%`, background: 'var(--reference)' }}
                  />
                </div>
              </div>
            </div>

            {/* Legal note */}
            <div className="p-3" style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
              <p className="text-[7px] leading-tight uppercase font-bold mb-1" style={{ color: 'var(--muted)' }}>
                Scientific note
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

/* ─── DATA LINEAGE BADGE ─── */
const LineageBadge = ({ metadata }: { metadata: { data_lineage: 'empirical_api' | 'statistical_fallback' } | undefined }) => {
  if (!metadata) return null;
  const isEmpirical = metadata.data_lineage === 'empirical_api';
  return (
    <div className={`mx-4 mb-4 p-3 border ${isEmpirical ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-amber-950/20 border-amber-900/35'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEmpirical ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className={`text-[7px] font-mono font-bold uppercase tracking-widest ${isEmpirical ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isEmpirical ? 'Empirical API · verified' : 'Statistical fallback active'}
        </span>
      </div>
      {!isEmpirical && (
        <p className="text-[7px] font-mono text-amber-500/70 leading-snug pl-3.5">
          Authoritative API timeout — latitude piecewise fallback deployed.
        </p>
      )}
    </div>
  );
};

/* ─── RIGHT PANEL ─── */
export const RightPanel = ({ isInitialized, year, isSimulating, mitigatedData, openAudit }: {
  isInitialized: boolean;
  year: number;
  isSimulating: boolean;
  mitigatedData: MitigatedData | null;
  openAudit: (k: 'mortality' | 'economics' | 'wetbulb') => void;
}) => {
  const { primaryData, primaryLoading } = useClimateData();

  // Always read from the single source of truth — same data as DeepDive and Compare
  const projection = primaryData?.projections?.find(p => p.year === year) ??
    (primaryData?.projections?.length
      ? primaryData.projections.reduce((c, p) => Math.abs(p.year - year) < Math.abs(c.year - year) ? p : c)
      : null);

  const deaths   = projection ? Math.round(projection.attributable_deaths).toLocaleString() : '--';
  const loss     = projection ? fmtLoss(projection.economic_decay_usd) : '--';
  const heatwave = projection ? Math.round(projection.heatwave_days).toString() : '--';
  const temp     = projection ? projection.peak_tx5d_c.toFixed(1) : '--';

  const isReady = isInitialized && !primaryLoading && projection != null;

  return (
    <div className="w-full md:w-[272px] md:min-w-[272px] flex flex-col md:h-full pointer-events-auto overflow-hidden"
         style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }} />
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--muted)' }}>
            Projected Indicators
          </span>
        </div>
        {isReady && (
          <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
            computed {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
        {primaryLoading && isInitialized && (
          <div className="w-3 h-3 border border-white/20 border-t-white/40 rounded-full animate-spin" />
        )}
      </div>

      {!isInitialized ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3 px-6">
          <div className="w-8 h-8 rounded-full border border-white/[0.05] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest text-center">Select a location to begin</p>
        </div>
      ) : (
        <div className="flex flex-col flex-grow overflow-y-auto custom-scrollbar divide-y divide-white/[0.04] animate-fadeIn">

          {/* ── DEATHS ── */}
          <div className="p-5 space-y-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[8px] font-mono uppercase tracking-widest font-bold flex items-center" style={{ color: 'var(--muted)' }}>
              Attributable Deaths
            </span>
            <div>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--muted)' }}>{deaths} <span className="text-[8px]">baseline</span></p>
                  <p className="text-[28px] font-mono font-bold leading-none tabular-nums" style={{ color: 'var(--positive)' }}>↓ {mitigatedData?.deaths || deaths}</p>
                </div>
              ) : (
                <p className="text-[32px] font-mono font-bold leading-none tabular-nums glow-red" style={{ color: 'var(--heat-4)' }}>{deaths}</p>
              )}
            </div>
            <ConfidenceBadge
              level="medium"
              note="Comparative triage only — not event-level prediction. Gasparrini 2017 chronic β."
            />
            <p className="text-[8px] font-mono leading-relaxed" style={{ color: 'var(--muted)' }}>
              ±15% CI · Gasparrini et al. 2017 · see methodology
            </p>
            {isSimulating && mitigatedData && <SavedBadge value={mitigatedData.savedDeaths || '0'} />}
            <AuditButton label="↳ show derivation" onClick={() => openAudit('mortality')} />
          </div>

          {/* ── ECONOMIC ── */}
          <div className="p-5 space-y-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[8px] font-mono uppercase tracking-widest font-bold flex items-center" style={{ color: 'var(--muted)' }}>
              Economic Impact
            </span>
            <div>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--muted)' }}>{loss} <span className="text-[8px]">baseline</span></p>
                  <p className="text-[24px] font-mono font-bold leading-none tabular-nums" style={{ color: 'var(--positive)' }}>↓ {mitigatedData?.loss || loss}</p>
                </div>
              ) : (
                <p className="text-[28px] font-mono font-bold leading-none tabular-nums glow-amber" style={{ color: 'var(--heat-2)' }}>{loss}</p>
              )}
            </div>
            <ConfidenceBadge
              level="medium"
              note="Indicative directional estimate. Burke 2018 + ILO bipartite model."
            />
            <p className="text-[8px] font-mono" style={{ color: 'var(--muted)' }}>
              ±8% CI · Burke et al. 2018 · Nature
            </p>
            {isSimulating && mitigatedData && <SavedBadge value={mitigatedData.savedLoss || '0'} />}
            <AuditButton label="↳ show derivation" onClick={() => openAudit('economics')} />
          </div>

          {/* ── CLIMATE INTELLIGENCE ── */}
          {primaryData?.climateIntelligence && (() => {
            const ci = primaryData.climateIntelligence as Record<string, unknown>;
            return (
              <div className="p-5 space-y-2.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <span className="text-[8px] font-mono uppercase tracking-widest font-bold flex items-center" style={{ color: 'var(--muted)' }}>
                  Climate Zone
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5"
                        style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}>
                    {ci.koppen_class as string}
                  </span>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--text)' }}>
                    {ci.koppen_label as string}
                  </span>
                </div>
                <p className="text-[8px] font-mono leading-snug" style={{ color: 'var(--muted)' }}>
                  {ci.koppen_description as string}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[8px] font-mono" style={{ color: 'var(--muted)' }}>IPCC AR6 warming rate</span>
                  <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: 'var(--copper)' }}>
                    {(ci.ipcc_warming_rate_factor as number).toFixed(2)}× global mean
                  </span>
                </div>
                {Array.isArray(ci.primary_risk_drivers) && (
                  <ul className="space-y-1 pt-0.5">
                    {(ci.primary_risk_drivers as string[]).slice(0, 3).map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--copper)' }} />
                        <span className="text-[8px] font-mono leading-snug" style={{ color: 'var(--muted)' }}>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[7px] font-mono italic" style={{ color: 'var(--reference)' }}>
                  Beck et al. 2018 · IPCC AR6 WG1
                </p>
              </div>
            );
          })()}

          {/* ── HEATWAVE + TEMP ── */}
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <span className="text-[8px] font-mono uppercase tracking-widest font-bold flex items-center" style={{ color: 'var(--muted)' }}>
                Heatwave Days
              </span>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--muted)' }}>{heatwave}d <span className="text-[8px]">baseline</span></p>
                  <p className="text-[24px] font-mono font-bold leading-none tabular-nums" style={{ color: 'var(--positive)' }}>↓ {mitigatedData?.heatwave || heatwave}d</p>
                </div>
              ) : (
                <p className="text-[26px] font-mono font-bold leading-none tabular-nums glow-red" style={{ color: 'var(--heat-3)' }}>{heatwave}d</p>
              )}
              <ConfidenceBadge level="high" />
              <p className="text-[8px] font-mono" style={{ color: 'var(--muted)' }}>days above historical P95 · CMIP6 ensemble</p>
            </div>

            <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              <span className="text-[8px] font-mono uppercase tracking-widest font-bold flex items-center" style={{ color: 'var(--muted)' }}>
                Peak Tx5d
              </span>
              {isSimulating ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--muted)' }}>{temp}°C <span className="text-[8px]">baseline</span></p>
                  <p className="text-[24px] font-mono font-bold leading-none tabular-nums" style={{ color: 'var(--positive)' }}>↓ {mitigatedData?.temp || temp}°C</p>
                </div>
              ) : (
                <p className="text-[26px] font-mono font-bold leading-none tabular-nums glow-amber" style={{ color: 'var(--heat-2)' }}>{temp}°C</p>
              )}
              <ConfidenceBadge level="high" />
              <p className="text-[8px] font-mono" style={{ color: 'var(--muted)' }}>TX5d decadal mean · CMIP6 + ERA5 reanalysis</p>
            </div>
          </div>
        </div>
      )}

      {isInitialized && !primaryLoading && (
        <div className="shrink-0 border-t border-white/[0.04] pt-3">
          <LineageBadge metadata={primaryData?.metadata} />
        </div>
      )}
    </div>
  );
};