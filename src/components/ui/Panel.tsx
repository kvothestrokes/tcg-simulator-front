/**
 * Panel del HUD: el marco con las esquinas cortadas del wireframe.
 *
 * El borde de 1px sobre una forma no rectangular necesita dos capas recortadas
 * con el mismo clip-path (ver .hud en global.css), así que conviene tenerlo
 * encapsulado en un componente y no repetirlo.
 */

import type { CSSProperties, ReactNode } from 'react';

export type PanelTone = 'default' | 'dim' | 'active' | 'danger';

interface PanelProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  tone?: PanelTone;
  /** Tamaño del corte de esquina en píxeles. */
  cut?: number;
  style?: CSSProperties;
}

const TONE_CLASS: Record<PanelTone, string> = {
  default: '',
  dim: 'hud--dim',
  active: 'hud--active',
  danger: 'hud--danger',
};

export function Panel({
  children,
  className = '',
  innerClassName = '',
  tone = 'default',
  cut = 14,
  style,
}: PanelProps) {
  return (
    <div
      className={`hud ${TONE_CLASS[tone]} ${className}`}
      style={{ ['--cut' as string]: `${cut}px`, ...style }}
    >
      <div className={`hud__inner ${innerClassName}`}>{children}</div>
    </div>
  );
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  /** Texto pequeño a la derecha del título (contadores, estado…). */
  meta?: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: PanelTone;
  cut?: number;
  titleSize?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const TITLE_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

/** Panel con cabecera, como cada zona del wireframe. */
export function PanelSection({
  title,
  children,
  meta,
  className = '',
  bodyClassName = '',
  tone = 'default',
  cut = 12,
  titleSize = 'md',
  style,
}: PanelSectionProps) {
  return (
    <Panel
      tone={tone}
      cut={cut}
      className={className}
      innerClassName="flex flex-col"
      style={style}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-2 px-2.5 pt-1.5 pb-1">
        <h3 className={`hud-title ${TITLE_SIZE[titleSize]}`}>{title}</h3>
        {meta ? <span className="hud-sub tabular shrink-0">{meta}</span> : null}
      </header>
      <div className={`min-h-0 flex-1 px-2 pb-2 ${bodyClassName}`}>{children}</div>
    </Panel>
  );
}
