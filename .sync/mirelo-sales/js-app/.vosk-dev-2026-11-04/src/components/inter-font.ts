import { Inter } from "next/font/google";

// Inter, self-hosted by next/font at build time, for the Mirelo and Nordmark reports (their design tokens). Exposed
// as a CSS variable on each report's root only, so the site keeps Geist.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const interFontVariable = inter.variable;
