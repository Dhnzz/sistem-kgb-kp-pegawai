'use client';

import { Badge } from '@/components/ui/badge';
import { forecastCredit, getNextJan1, willPromote } from '@/lib/credit';
import { toISODate } from '@/lib/schedule';

type Props = {
  kredit: number | string;
  jenis: string;
  thresholdNext: number | string | null | undefined;
  today?: Date | string;
  className?: string;
};

export function ForecastBadge({ kredit, jenis, thresholdNext, today, className = '' }: Props) {
  if (jenis === 'struktural') return null;
  if (thresholdNext === null || thresholdNext === undefined) return null;

  const forecast = forecastCredit(kredit, jenis);
  const promote = willPromote(kredit, jenis, thresholdNext);
  const nextJan = getNextJan1(today);
  const nextJanStr = toISODate(nextJan);

  if (promote) {
    return (
      <Badge className={`bg-amber-50 text-amber-800 border border-amber-200 ${className}`} title={`Forecast ${forecast} >= ${thresholdNext}`}>
        Diprediksi naik 1 Jan {nextJan.getUTCFullYear()} ({nextJanStr})
      </Badge>
    );
  }

  // Not crossing yet — show muted badge with forecast
  return (
    <Badge className={`bg-slate-50 text-slate-600 border border-slate-200 ${className}`} title={`Forecast ${forecast} < ${thresholdNext}`}>
      Forecast {forecast}/{thresholdNext} — belum cukup
    </Badge>
  );
}
