interface Props {
  html: string;
  title?: string;
  /** Workspace file previews may need scripts/styles from srcdoc. */
  allowScripts?: boolean;
}

export function HtmlPreviewFrame({ html, title, allowScripts = false }: Props) {
  const sandbox = allowScripts ? "allow-scripts allow-same-origin" : "";
  return (
    <iframe
      className="html-preview-frame"
      sandbox={sandbox}
      srcDoc={html}
      title={title ?? "HTML preview"}
    />
  );
}
