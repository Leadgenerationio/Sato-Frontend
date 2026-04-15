interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 'size-7', text: 'text-base', bar1: 'h-[10px]', bar2: 'h-[16px]', bar3: 'h-[12px]', barW: 'w-[3px]', gap: 'gap-[2.5px]' },
  md: { icon: 'size-9', text: 'text-xl', bar1: 'h-[12px]', bar2: 'h-[20px]', bar3: 'h-[15px]', barW: 'w-[3.5px]', gap: 'gap-[3px]' },
  lg: { icon: 'size-11', text: 'text-2xl', bar1: 'h-[14px]', bar2: 'h-[24px]', bar3: 'h-[18px]', barW: 'w-[4px]', gap: 'gap-[3.5px]' },
  xl: { icon: 'size-14', text: 'text-3xl', bar1: 'h-[18px]', bar2: 'h-[30px]', bar3: 'h-[22px]', barW: 'w-[5px]', gap: 'gap-[4px]' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className || ''}`}>
      <div className={`${s.icon} flex items-center justify-center rounded-lg bg-neutral-900`}>
        <div className={`flex items-end ${s.gap}`}>
          <div className={`${s.barW} ${s.bar1} rounded-full bg-white`} />
          <div className={`${s.barW} ${s.bar2} rounded-full bg-white`} />
          <div className={`${s.barW} ${s.bar3} rounded-full bg-white`} />
        </div>
      </div>
      {showText && (
        <span className={`${s.text} font-bold tracking-tight text-neutral-900`}>
          Stato
        </span>
      )}
    </div>
  );
}

export function LogoWhite({ size = 'md', showText = true, className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className || ''}`}>
      <div className={`${s.icon} flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/20`}>
        <div className={`flex items-end ${s.gap}`}>
          <div className={`${s.barW} ${s.bar1} rounded-full bg-white`} />
          <div className={`${s.barW} ${s.bar2} rounded-full bg-white`} />
          <div className={`${s.barW} ${s.bar3} rounded-full bg-white`} />
        </div>
      </div>
      {showText && (
        <span className={`${s.text} font-bold tracking-tight text-white`}>
          Stato
        </span>
      )}
    </div>
  );
}
