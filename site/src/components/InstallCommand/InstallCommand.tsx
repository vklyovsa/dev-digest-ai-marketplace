import type { ReactNode } from 'react';
import { CopyButton } from '../CopyButton/CopyButton';

interface Props {
  command: string;
  size?: 'inline' | 'large';
  children?: ReactNode;
}

export function InstallCommand({ command, size = 'large', children }: Props) {
  if (size === 'inline') {
    return (
      <div className="terminal">
        <span className="terminal-prompt">$</span>
        <code className="terminal-cmd">{command}</code>
        <CopyButton text={command} variant="link" />
      </div>
    );
  }
  return (
    <div className="install">
      <div className="terminal">
        <span className="terminal-prompt">$</span>
        <code className="terminal-cmd">{command}</code>
      </div>
      <CopyButton text={command} variant="primary" size="lg" />
      {children}
    </div>
  );
}
