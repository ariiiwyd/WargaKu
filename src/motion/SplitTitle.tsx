import type { ElementType } from 'react';

type Props = { text: string; as?: ElementType; className?: string; id?: string; tabIndex?: number };

/** Pecah kata menjadi huruf; tanda baca menempel ke huruf sebelumnya agar kerning tetap rapat. */
function glyphs(word: string) {
  const out: string[] = [];
  for (const ch of word) {
    if (/[.,!?;:)]/.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** Judul dipecah per huruf (dianimasikan oleh usePageEnter). Pembaca layar membaca aria-label. */
export function SplitTitle({ text, as: Tag = 'h1', className, id, tabIndex }: Props) {
  const words = text.split(' ');
  return (
    <Tag className={className} id={id} tabIndex={tabIndex} aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi} aria-hidden="true">
          <span className="-mb-[0.08em] inline-block overflow-hidden pb-[0.08em] align-top">
            {glyphs(word).map((ch, ci) => (
              <span key={ci} data-ch className="inline-block will-change-transform">
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
