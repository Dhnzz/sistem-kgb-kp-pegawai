import * as React from 'react';

export function RitmeMark({ className = '', size = 40 }: { className?: string; size?: number }) {
  return (
    <span
      aria-label="Ritme"
      className={`inline-flex items-center justify-center rounded-[10px] bg-[#2563EB] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r="10.5"
          fill="none"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="22 7"
          opacity="0.92"
        />
        <path
          d="M 10.5 20 L 14.2 20 L 16 14.2 L 18.2 25.8 L 20.6 15.2 L 22.8 20 L 29.5 20"
          fill="none"
          stroke="white"
          strokeWidth="2.05"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="29.5" cy="20" r="1.7" fill="white" />
      </svg>
    </span>
  );
}
