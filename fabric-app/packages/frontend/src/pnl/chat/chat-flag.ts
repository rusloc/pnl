// AI chat feature flag (ADR-0009). OFF unless `RAYFIN_PUBLIC_PNL_CHAT=on` is in
// rayfin/.env (`rayfin env` maps it to VITE_RAYFIN_PNL_CHAT at build time), so a
// static-app deploy without the function enabled shows no assistant at all.
export const CHAT_ENABLED: boolean = import.meta.env.VITE_RAYFIN_PNL_CHAT === 'on';
