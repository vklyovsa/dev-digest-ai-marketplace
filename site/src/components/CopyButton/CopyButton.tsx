import { useCopy } from '../../hooks/useCopy';
import { en } from '../../i18n/en';

interface Props {
  text: string;
  label?: string;
  variant?: 'default' | 'primary' | 'link';
  size?: 'sm' | 'lg';
}

export function CopyButton({ text, label = en.common.copy, variant = 'default', size = 'sm' }: Props) {
  const [state, copy] = useCopy();
  const shown = state === 'copied' ? en.common.copied : state === 'failed' ? en.common.copyFailed : label;
  const className =
    variant === 'link' ? 'link-btn' : ['btn', variant === 'primary' && 'btn-primary', size === 'lg' && 'btn-lg'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={className}
      data-copied={state === 'copied'}
      aria-live="polite"
      title={text}
      onClick={(e) => {
        e.stopPropagation();
        copy(text);
      }}
    >
      {shown}
    </button>
  );
}
