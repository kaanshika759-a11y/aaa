"use client";

import React from "react";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  hideText?: boolean;
  className?: string;
  asLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  showTagline = true,
  hideText = false,
  className = "",
  asLink = true,
}) => {
  const iconSize = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  }[size];

  const titleSize = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  const taglineSize = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  }[size];

  const content = (
    <div className={`inline-flex items-center gap-3 group select-none ${className}`}>
      {/* ── Squircle Icon Badge with Glow ── */}
      <div className="relative flex-shrink-0">
        <div
          className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 via-blue-600/30 to-indigo-600/30 rounded-2xl blur-sm group-hover:blur transition duration-300 opacity-80"
          aria-hidden="true"
        />
        <div
          className={`${iconSize} relative rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-[1.5px] shadow-lg shadow-cyan-500/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
        >
          <div className="w-full h-full bg-slate-950/40 rounded-[14px] flex items-center justify-center backdrop-blur-sm">
            {/* ── Custom Vector Logo: Mic + Speech Wave + Sparkle ── */}
            <svg
              className="w-3/5 h-3/5 text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Speech Bubble Contour */}
              <path
                d="M3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11C19 12.825 18.3888 14.507 17.3571 15.8571L18.5 20.5L14.0416 19.3137C13.085 19.756 12.0673 20 11 20C6.58172 20 3 16.4183 3 11Z"
                stroke="url(#speech-grad)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.1"
              />
              {/* Central Dynamic Mic Body */}
              <rect
                x="9.5"
                y="6.5"
                width="3"
                height="6.5"
                rx="1.5"
                fill="white"
                className="text-white"
              />
              {/* Mic Stand Cradle */}
              <path
                d="M7.5 10.5C7.5 12.433 9.067 14 11 14C12.933 14 14.5 12.433 14.5 10.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M11 14V16.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* AI Sparkle Star */}
              <path
                d="M19.5 4.5C19.5 5.88 20.62 7 22 7C20.62 7 19.5 8.12 19.5 9.5C19.5 8.12 18.38 7 17 7C18.38 7 19.5 5.88 19.5 4.5Z"
                fill="#38BDF8"
              />
              {/* Gradients */}
              <defs>
                <linearGradient
                  id="speech-grad"
                  x1="3"
                  y1="3"
                  x2="22"
                  y2="20.5"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#38BDF8" />
                  <stop offset="0.5" stopColor="#6366F1" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Brand Typography ── */}
      {!hideText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center leading-none tracking-tight">
            <span className={`font-display font-extrabold text-slate-50 ${titleSize}`}>
              Apni
            </span>
            <span
              className={`font-display font-extrabold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent ml-0.5 ${titleSize}`}
            >
              Awaaz
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1 mb-1 animate-pulse shadow-sm shadow-cyan-400" />
          </div>
          {showTagline && (
            <p className={`text-slate-400 font-medium tracking-wide mt-1 leading-none ${taglineSize}`}>
              AI Communication Coach
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link href="/" className="focus:outline-none" aria-label="ApniAwaaz Home">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
