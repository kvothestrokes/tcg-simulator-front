/**
 * Logotipo del wireframe: dos líneas en caja alta con el glifo orbital en medio
 * y las guías horizontales a los lados.
 */

interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  withRules?: boolean;
  className?: string;
}

const SIZE: Record<'sm' | 'md' | 'lg', { text: string; glyph: number; gap: string }> = {
  sm: { text: 'text-base', glyph: 18, gap: 'gap-2' },
  md: { text: 'text-2xl', glyph: 26, gap: 'gap-3' },
  lg: { text: 'text-4xl sm:text-5xl', glyph: 40, gap: 'gap-4' },
};

export function Wordmark({ size = 'md', withRules = false, className = '' }: WordmarkProps) {
  const s = SIZE[size];
  return (
    <div className={`flex items-center justify-center ${s.gap} ${className}`}>
      {withRules ? <span className="h-px flex-1 bg-[var(--color-stroke-dim)]" /> : null}

      <div className="flex items-center gap-3">
        <OrbitGlyph size={s.glyph} />
        <span className={`display leading-[0.92] ${s.text}`}>
          <span className="block">Cosmic</span>
          <span className="block">Breaker</span>
        </span>
      </div>

      {withRules ? <span className="h-px flex-1 bg-[var(--color-stroke-dim)]" /> : null}
    </div>
  );
}

function OrbitGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="12.5" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
      <ellipse
        cx="20"
        cy="20"
        rx="18.5"
        ry="7"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
        transform="rotate(-28 20 20)"
      />
      <circle cx="20" cy="20" r="3.4" fill="var(--color-signal)" />
      <circle cx="35.2" cy="12.6" r="1.6" fill="currentColor" />
      <circle cx="4.8" cy="27.4" r="1.6" fill="currentColor" />
    </svg>
  );
}
