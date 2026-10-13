'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Utility Functions for Color Math --- //

interface HSL {
  h: number; // 0 to 360
  s: number; // 0 to 100
  l: number; // 0 to 100
}

function hslToHex({ h, s, l }: HSL): string {
  s /= 100;
  l /= 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex: string): HSL {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }

  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function normalizeHue(h: number): number {
  return (h % 360 + 360) % 360;
}

// Helper to calculate contrast text color (Black or White) based on lightness
function getContrastTextColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  // YIQ formula for perceived brightness
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0f172a' : '#ffffff';
}

// --- Main UI Component --- //

export default function ColorizeUI() {
  const [hsl, setHsl] = useState<HSL>({ h: 210, s: 80, l: 50 });
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [activeSchemeTab, setActiveSchemeTab] = useState<'complementary' | 'analogous' | 'splitComplementary'>('complementary');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef<boolean>(false);

  const hexColor = hslToHex(hsl);

  // --- Calculate Color Schemes --- //
  const complementary = [
    hexColor,
    hslToHex({ ...hsl, h: normalizeHue(hsl.h + 180) }),
  ];

  const analogous = [
    hslToHex({ ...hsl, h: normalizeHue(hsl.h - 30) }),
    hexColor,
    hslToHex({ ...hsl, h: normalizeHue(hsl.h + 30) }),
  ];

  const splitComplementary = [
    hexColor,
    hslToHex({ ...hsl, h: normalizeHue(hsl.h + 150) }),
    hslToHex({ ...hsl, h: normalizeHue(hsl.h + 210) }),
  ];

  // Get active scheme array for the Mockup UI preview
  const currentSchemeColors =
    activeSchemeTab === 'complementary' ? complementary :
    activeSchemeTab === 'analogous' ? analogous : splitComplementary;

  // --- Draw Color Wheel Canvas --- //
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;

    ctx.clearRect(0, 0, width, height);

    // Render Hue/Saturation wheel pixels
    for (let x = -radius; x < radius; x++) {
      for (let y = -radius; y < radius; y++) {
        const distance = Math.sqrt(x * x + y * y);

        if (distance <= radius) {
          let angle = Math.atan2(y, x) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const sat = (distance / radius) * 100;
          ctx.fillStyle = `hsl(${angle}, ${sat}%, ${hsl.l}%)`;
          ctx.fillRect(x + radius, y + radius, 1, 1);
        }
      }
    }

    // Draw active color indicator pin
    const angleRad = (hsl.h * Math.PI) / 180;
    const pinRadius = (hsl.s / 100) * radius;
    const pinX = radius + pinRadius * Math.cos(angleRad);
    const pinY = radius + pinRadius * Math.sin(angleRad);

    ctx.beginPath();
    ctx.arc(pinX, pinY, 8, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pinX, pinY, 9, 0, 2 * Math.PI);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsl]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Handle interaction with the wheel
  const handleWheelInteraction = (e: React.MouseEvent<HTMLCanvasElement> | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left - canvas.width / 2;
    const y = clientY - rect.top - canvas.height / 2;

    const distance = Math.sqrt(x * x + y * y);
    const maxRadius = canvas.width / 2;

    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    const sat = Math.min(100, Math.round((distance / maxRadius) * 100));

    setHsl(prev => ({
      ...prev,
      h: Math.round(angle),
      s: sat,
    }));
  };

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  // Mockup UI derived colors
  const primaryColor = currentSchemeColors[0];
  const secondaryColor = currentSchemeColors[1] || currentSchemeColors[0];
  const accentColor = currentSchemeColors[2] || primaryColor;
  const buttonTextColor = getContrastTextColor(primaryColor);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
          Colorize
        </h1>
        <p className="text-slate-400">
          Pick a color on the interactive wheel to explore harmonies and test them live on a mockup UI card.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Color Wheel & Controls */}
        <div className="lg:col-span-5 bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center shadow-xl">
          <div className="relative cursor-crosshair mb-6">
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="rounded-full shadow-md"
              onMouseDown={(e) => {
                isDragging.current = true;
                handleWheelInteraction(e);
              }}
              onMouseMove={(e) => {
                if (isDragging.current) handleWheelInteraction(e);
              }}
              onMouseUp={() => (isDragging.current = false)}
              onMouseLeave={() => (isDragging.current = false)}
              onTouchStart={(e) => {
                isDragging.current = true;
                handleWheelInteraction(e.nativeEvent);
              }}
              onTouchMove={(e) => {
                if (isDragging.current) handleWheelInteraction(e.nativeEvent);
              }}
              onTouchEnd={() => (isDragging.current = false)}
            />
          </div>

          {/* Color Adjusters */}
          <div className="w-full space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium mb-1 text-slate-300">
                <span>Lightness</span>
                <span>{hsl.l}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.l}
                onChange={(e) => setHsl({ ...hsl, l: Number(e.target.value) })}
                className="w-full accent-indigo-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Direct Hex Input */}
            <div className="flex items-center space-x-3 pt-2">
              <div
                className="w-10 h-10 rounded-lg border-2 border-slate-600 shadow-inner"
                style={{ backgroundColor: hexColor }}
              />
              <div className="flex-1">
                <label className="text-xs text-slate-400 block">HEX Code</label>
                <input
                  type="text"
                  value={hexColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-F]{6}$/i.test(val)) {
                      setHsl(hexToHsl(val));
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Color Scheme Recommendations & Live UI Preview */}
        <div className="lg:col-span-7 space-y-6">
          {/* Scheme Recommendations Sections */}
          <div className="space-y-6">
            <SchemeSection
              title="Complementary"
              description="Direct opposite on the color wheel."
              colors={complementary}
              onCopy={copyToClipboard}
              copiedHex={copiedHex}
            />

            <SchemeSection
              title="Analogous"
              description="Adjacent harmonious colors on the wheel."
              colors={analogous}
              onCopy={copyToClipboard}
              copiedHex={copiedHex}
            />

            <SchemeSection
              title="Split Complementary"
              description="Base color plus two colors adjacent to its complement."
              colors={splitComplementary}
              onCopy={copyToClipboard}
              copiedHex={copiedHex}
            />
          </div>

          {/* --- Live Mockup UI Card Implementation Section --- */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Live Mockup UI Card</h2>
                <p className="text-xs text-slate-400">See how your colors look applied on a component interface.</p>
              </div>

              {/* Tabs to select active palette for the preview */}
              <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 text-xs">
                <button
                  onClick={() => setActiveSchemeTab('complementary')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    activeSchemeTab === 'complementary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Complementary
                </button>
                <button
                  onClick={() => setActiveSchemeTab('analogous')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    activeSchemeTab === 'analogous' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Analogous
                </button>
                <button
                  onClick={() => setActiveSchemeTab('splitComplementary')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    activeSchemeTab === 'splitComplementary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Split-Comp
                </button>
              </div>
            </div>

            {/* Mockup Component Container */}
            <div className="p-6 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center">
              <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden transition-all">
                {/* Card Header with dynamic accent bar or background tint */}
                <div
                  className="p-5 relative overflow-hidden"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${secondaryColor}30`, color: secondaryColor }}
                    >
                      Pro Plan
                    </span>
                    <span className="text-xs font-mono text-slate-400">Monthly</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Unlimited Suite</h3>
                  <p className="text-xs text-slate-400 mt-1">Advanced design assets powered by your custom scheme.</p>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4 border-t border-slate-800/60">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-extrabold text-white">$29</span>
                    <span className="text-xs text-slate-400">/ user</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}>✓</span>
                      <span>Custom color harmonies</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}>✓</span>
                      <span>Instant HEX export</span>
                    </li>
                  </ul>

                  {/* Action Button styled using Primary color */}
                  <button
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm shadow-md transition-transform active:scale-95"
                    style={{ backgroundColor: primaryColor, color: buttonTextColor }}
                  >
                    Get Started Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Card Section Subcomponent
function SchemeSection({
  title,
  description,
  colors,
  onCopy,
  copiedHex,
}: {
  title: string;
  description: string;
  colors: string[];
  onCopy: (hex: string) => void;
  copiedHex: string | null;
}) {
  return (
    <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 shadow-lg">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {colors.map((hex, idx) => (
          <button
            key={`${hex}-${idx}`}
            onClick={() => onCopy(hex)}
            className="group relative flex flex-col items-center p-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-600 transition-all text-left overflow-hidden"
          >
            <div
              className="w-full h-12 rounded-lg mb-2 shadow-inner group-hover:scale-[1.02] transition-transform"
              style={{ backgroundColor: hex }}
            />
            <span className="font-mono text-xs font-semibold text-slate-300 uppercase">
              {copiedHex === hex ? 'Copied!' : hex}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}