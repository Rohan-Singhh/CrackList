import type { CSSProperties, ReactNode } from 'react';

export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

interface BlueprintProps {
  as?: 'div' | 'a' | 'button';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  [key: string]: unknown;
}

export function Blueprint({ as = 'div', className = '', style, children, ...rest }: BlueprintProps) {
  const Tag = as as any;
  return (
    <Tag className={`blueprint ${className}`} style={style} {...rest}>
      <Corners />
      {children}
    </Tag>
  );
}
