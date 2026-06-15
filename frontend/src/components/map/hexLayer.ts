/**
 * map/hexLayer.ts — H3HexagonLayer factory for the heat-risk map.
 * Extracted from MapModule.tsx to keep the orchestrator lean.
 */

import { H3HexagonLayer } from '@deck.gl/geo-layers';

type H3Datum = { hex: string; risk: number };

export function buildHexLayer(h3Data: H3Datum[], zoom: number) {
  return new H3HexagonLayer<H3Datum>({
    id: 'h3-core-layer',
    data: h3Data,
    getHexagon: (d) => d.hex,
    getFillColor: (d) => {
      const risk = Math.max(0, Math.min(1, d.risk || 0));
      // heat-1 steel, heat-2 ochre, heat-3 amber, heat-4 oxide red, heat-5 deep oxide
      const h1: [number,number,number] = [47,  111, 143];  // #2F6F8F
      const h2: [number,number,number] = [183, 146, 55 ];  // #B79237
      const h3: [number,number,number] = [190, 106, 46 ];  // #BE6A2E
      const h4: [number,number,number] = [162, 58,  48 ];  // #A23A30
      const h5: [number,number,number] = [110, 32,  32 ];  // #6E2020
      let c1: [number,number,number], c2: [number,number,number], t: number;
      if      (risk < 0.25) { c1 = h1; c2 = h2; t = risk / 0.25; }
      else if (risk < 0.50) { c1 = h2; c2 = h3; t = (risk - 0.25) / 0.25; }
      else if (risk < 0.75) { c1 = h3; c2 = h4; t = (risk - 0.50) / 0.25; }
      else                  { c1 = h4; c2 = h5; t = (risk - 0.75) / 0.25; }
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
        Math.round(140 + risk * 80),  // opacity 140-220, varies with intensity
      ];
    },
    extruded: false,
    coverage: zoom >= 11.5 ? 1.0 : 0.88,
    stroked: false,
    // @ts-expect-error -- beforeId is read by @deck.gl/mapbox interleaved resolver at runtime; not in LayerProps types
    beforeId: 'settlement-label',
    updateTriggers: { getFillColor: h3Data, coverage: zoom },
  });
}
