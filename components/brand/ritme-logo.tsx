import Link from 'next/link';
import { RitmeMark } from './ritme-mark';

export function RitmeLogo({
  href = '/dashboard',
  withTagline = true,
  size = 36,
}: {
  href?: string | null;
  withTagline?: boolean;
  size?: number;
}) {
  const content = (
    <span className="flex items-center gap-3">
      <RitmeMark size={size} />
      <span className="leading-none">
        <span className="block text-[19px] font-extrabold tracking-tight text-slate-900">Ritme</span>
        {withTagline ? (
          <span className="block text-[9px] font-semibold tracking-[0.14em] text-slate-500">KGB · KP · TEPAT WAKTU</span>
        ) : null}
      </span>
    </span>
  );
  if (href === null) return content;
  return (
    <Link href={href} aria-label="Ritme — ke dashboard" className="inline-flex">
      {content}
    </Link>
  );
}
