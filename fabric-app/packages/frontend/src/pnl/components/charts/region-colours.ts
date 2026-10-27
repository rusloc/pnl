// Categorical colours of the regions on the Profitability panels and the variance
// cut segments: company colour, ink, slate, line (white text on the first two).
export const REGION_FILL = ['var(--acc)', '#2B3748', '#8592A3', '#CDD4DC'] as const;
export const REGION_INK = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#101B2B'] as const;

export function regionColour(index: number): { fill: string; ink: string } {
  return { fill: REGION_FILL[index % REGION_FILL.length], ink: REGION_INK[index % REGION_INK.length] };
}
