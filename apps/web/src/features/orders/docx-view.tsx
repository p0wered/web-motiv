import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Notice } from '../../components/ui.tsx';

/** Подложка документа внутри теневого дерева: страницы — на фоне карточки, без серой рамки. */
const BASE_CSS = `
  :host { display: block; }
  .docx-wrapper { background: transparent !important; padding: 0 !important; }
  .docx-wrapper > section.docx { margin: 0 auto 16px !important; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08) !important; }
`;

/**
 * Просмотр DOCX в браузере (docx-preview, отдельный чанк). Документ рисуется в Shadow DOM: его
 * стили не задевают интерфейс, а сам он не видит страницу. Стили документа подключаются как
 * конструируемая таблица стилей, а не <style> — строгий CSP страницы не ослабляется.
 */
export function DocxView({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new AbortController();
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

    (async () => {
      const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const { parseAsync, renderDocument } = await import('docx-preview');
      const options = { ignoreFonts: true, breakPages: true, className: 'docx' };
      const document = await parseAsync(data, options);
      const nodes = await renderDocument(document, options);
      if (controller.signal.aborted) return;

      const css = nodes
        .filter((node) => node.nodeName === 'STYLE')
        .map((node) => node.textContent ?? '')
        .join('\n');
      const base = new CSSStyleSheet();
      base.replaceSync(BASE_CSS);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet, base];
      shadow.replaceChildren(...nodes.filter((node) => node.nodeName !== 'STYLE'));
      setState('ready');
    })().catch(() => {
      if (!controller.signal.aborted) setState('error');
    });

    return () => controller.abort();
  }, [url]);

  return (
    <div className="relative h-full overflow-auto rounded-xl bg-sunken p-4">
      {state === 'loading' && (
        <p className="flex items-center gap-2 text-[13px] text-subtle">
          <Loader2 aria-hidden size={15} className="animate-spin" /> Открываем документ…
        </p>
      )}
      {state === 'error' && (
        <Notice tone="error">Документ не удалось показать — скачайте его.</Notice>
      )}
      <div ref={hostRef} />
    </div>
  );
}
