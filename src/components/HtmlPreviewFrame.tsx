import { prepareHtmlSrcDoc } from "../htmlPreview";

interface Props {
  html: string;
  title?: string;
  /** Workspace file previews may need scripts/styles from srcdoc. */
  allowScripts?: boolean;
  /** When set, relative assets (CSS, images) resolve against this directory. */
  baseHref?: string;
}

export function HtmlPreviewFrame({
  html,
  title,
  allowScripts = false,
  baseHref,
}: Props) {
  const sandbox = allowScripts ? "allow-scripts allow-same-origin" : "";
  return (
    <iframe
      className="html-preview-frame"
      sandbox={sandbox}
      srcDoc={prepareHtmlSrcDoc(html, baseHref)}
      title={title ?? "HTML preview"}
    />
  );
}
