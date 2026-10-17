import { useMemo } from 'react';
import { useBody } from '../../data/useBody';
import { en } from '../../i18n/en';
import { renderMarkdown } from './sanitize';

interface SourceProps {
  source: string;
  baseUrl?: string | null;
}

export function MarkdownText({ source, baseUrl = null }: SourceProps) {
  const html = useMemo(() => renderMarkdown(source, baseUrl), [source, baseUrl]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface BodyProps {
  path: string;
  baseUrl?: string | null;
}

export function MarkdownBody({ path, baseUrl = null }: BodyProps) {
  const body = useBody(path);
  if (body.status === 'loading') return <p className="faint">{en.common.loading}</p>;
  if (body.status === 'error') return <p className="faint">{en.common.bodyFailed}</p>;
  return <MarkdownText source={body.text} baseUrl={baseUrl} />;
}
