'use client';

import { kreditProgressPercent } from '@/lib/credit';

type Props = {
  kredit: number | string;
  thresholdNext: number | string | null | undefined;
  className?: string;
  showLabel?: boolean;
};

export function CreditProgressBar({ kredit, thresholdNext, className = '', showLabel = true }: Props) {
  const pct = kreditProgressPercent(kredit, thresholdNext);
  const kreditStr = String(kredit);
  const thrStr = thresholdNext === null || thresholdNext === undefined ? '-' : String(thresholdNext);

  if (thresholdNext === null || thresholdNext === undefined) {
    return (
      <div className={`text-xs text-slate-500 ${className}`}>
        {showLabel && <span>Puncak — tidak ada threshold</span>}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">
            {kreditStr}/{thrStr}
          </span>
          <span className="text-slate-500">{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-[#2563EB] transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
