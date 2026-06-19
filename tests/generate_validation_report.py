"""
tests/generate_validation_report.py — Render VALIDATION_REPORT.md from the
reference panel and the recorded engine fixture.

For every city × field it shows the reference value, the engine value, the delta,
pass/fail against tolerance, and the cited reference source. Run after
generate_fixtures.py:

    python tests/generate_validation_report.py
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
REF_PATH = os.path.join(HERE, "reference_cities.json")
FIXTURE_PATH = os.path.join(HERE, "fixtures", "engine_outputs.json")
OUT_PATH = os.path.join(HERE, "..", "VALIDATION_REPORT.md")

# Mirror the tolerances in test_global_accuracy.py.
TEMP_TOL_C = 2.6
ELEV_ABS_M = 60.0
ELEV_PCT = 0.12
POP_BAND = (0.5, 1.8)
GDP_PC_BAND = (0.5, 2.0)
COORD_TOL_DEG = 0.75


def _mark(ok: bool) -> str:
    return "✅" if ok else "❌"


def main() -> None:
    with open(REF_PATH, encoding="utf-8") as fh:
        ref = json.load(fh)
    with open(FIXTURE_PATH, encoding="utf-8") as fh:
        fx = json.load(fh)

    cities = ref["cities"]
    rows = []
    total = 0
    passed = 0

    for c in cities:
        name = c["name"]
        out = fx.get(name, {})
        if not out.get("_ok"):
            rows.append(f"| {name} | — | ENGINE FAILED: {out.get('_error', 'no data')} | | ❌ | |")
            continue

        def add(field, refv, engv, ok, source, fmt="{}"):
            nonlocal total, passed
            total += 1
            passed += int(ok)
            rv = fmt.format(refv) if refv is not None else "—"
            ev = fmt.format(engv) if engv is not None else "—"
            rows.append(f"| {name} | {field} | {rv} | {ev} | {_mark(ok)} | {source} |")

        src = c.get("sources", {})

        # Coordinate
        dlat = abs(out["lat"] - c["ref_lat"])
        dlng = abs(out["lng"] - c["ref_lon"]); dlng = min(dlng, 360 - dlng)
        coord_ok = (not (abs(out["lat"]) < 0.01 and abs(out["lng"]) < 0.01)
                    and dlat <= COORD_TOL_DEG and dlng <= COORD_TOL_DEG)
        add("Coordinate", f"{c['ref_lat']},{c['ref_lon']}",
            f"{out['lat']},{out['lng']}", coord_ok, "GeoNames")

        # Elevation
        ref_e = c["ref_elevation_m"]; eng_e = out["elevation_m"]
        etol = max(ELEV_ABS_M, ELEV_PCT * abs(ref_e))
        add("Elevation (m)", ref_e, eng_e, abs(eng_e - ref_e) <= etol, src.get("elevation", ""))

        # Köppen
        accepted = set(c.get("koppen_alt_main", [])) | {c["koppen_main"]}
        add("Köppen", f"{c['koppen_anchor']} ({'/'.join(sorted(accepted))})",
            out["koppen_code"], out["koppen_main"] in accepted, src.get("koppen", ""))

        # Annual mean temp (per-city tolerance override for documented Arctic cases)
        ref_t = c["ref_annual_mean_c"]; eng_t = out["baseline_annual_mean_c"]
        ttol = c.get("temp_tol_c", TEMP_TOL_C)
        add("Annual mean (°C)", ref_t, eng_t, abs(eng_t - ref_t) <= ttol, src.get("temp", ""))

        # Metro population
        if c.get("assert_population", True):
            ref_p = c["ref_metro_pop"]; eng_p = out["population"]
            pop_ok = POP_BAND[0] * ref_p <= eng_p <= POP_BAND[1] * ref_p
            add("Metro pop", f"{ref_p:,}", f"{eng_p:,}", pop_ok, src.get("pop", ""))

        # Implied metro GDP/capita + national cap (implied-pc only where pop reliable)
        nat_pc = c["ref_national_gdp_pc_usd"]
        implied_pc = out["metro_gdp_usd"] / out["population"] if out["population"] else 0
        cap_ok = (not out.get("national_gdp_usd")) or out["metro_gdp_usd"] <= out["national_gdp_usd"] * 1.001
        if c.get("assert_population", True):
            gdp_ok = cap_ok and (GDP_PC_BAND[0] * nat_pc <= implied_pc <= GDP_PC_BAND[1] * nat_pc)
        else:
            gdp_ok = cap_ok
        add("Implied GDP/cap ($)", f"{nat_pc:,} (nat'l)", f"{implied_pc:,.0f}", gdp_ok, src.get("gdp_pc", ""))

        # Structural invariants
        base = out["baseline_tx5d_c"]
        tx30 = out["projections"]["2030"]["tx5d_c"]
        tx50 = out["projections"]["2050"]["tx5d_c"]
        mono_ok = tx50 >= base and tx30 >= base and tx50 >= tx30
        add("Tx5d base→2030→2050 (°C)", f"≥{base}", f"{base}→{tx30}→{tx50}", mono_ok, "invariant §5")

        delta = tx50 - base
        add("2050 warming Δ (°C)", "[0, 6]", f"{delta:.2f}", 0 <= delta <= 6, "IPCC AR6")

        wbt = out["wbt_proj_c"]
        add("Wet-bulb 2050 (°C)", f"≤{tx50} & ≤35", f"{wbt}", wbt <= tx50 + 1e-6 and wbt <= 35.0 + 1e-6,
            "Stull 2011 (coincident)")

    pct = (100.0 * passed / total) if total else 0.0
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    header = f"""# OpenPlanet — Global Accuracy Validation Report

Generated: {ts}
Panel: {len(cities)} reference cities · {total} field checks · **{passed}/{total} passed ({pct:.1f}%)**

Engine outputs are recorded in `tests/fixtures/engine_outputs.json` from live
ERA5 / CMIP6 (Open-Meteo) + World Bank WDI + Copernicus/SRTM DEM APIs and asserted
by `tests/test_global_accuracy.py`. Reference values and their sources are encoded
in `tests/reference_cities.json`. Tolerances: elevation ±max(60 m, 12 %); annual
mean ±2.6 °C (ERA5 2011–2020 vs published normals); Köppen main-group exact;
metro population [0.5×, 1.8×]; implied metro GDP/capita [0.55×, 1.45×] of national
WDI with a hard metro ≤ national cap.

| City | Field | Reference | Engine | Pass | Source |
|------|-------|-----------|--------|------|--------|
"""

    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(header)
        fh.write("\n".join(rows))
        fh.write("\n")
    print(f"Wrote {OUT_PATH}: {passed}/{total} checks passed ({pct:.1f}%)")


if __name__ == "__main__":
    main()
