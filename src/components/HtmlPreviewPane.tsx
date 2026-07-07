import { htmlPreviewPayload, parseHtmlPreviewKey } from "../htmlPreview";
import { HtmlPreviewFrame } from "./HtmlPreviewFrame";
import { Icon } from "./Icon";
import { useStore } from "../store";

interface Props {
  tabKey: string;
}

export function HtmlPreviewPane({ tabKey }: Props) {
  const parsed = parseHtmlPreviewKey(tabKey);
  const payload = htmlPreviewPayload(tabKey);
  if (!parsed || !payload) {
    return (
      <div className="html-preview-pane html-preview-pane-error">
        <Icon name="alert-triangle" size={20} />
        <span>Preview is no longer available.</span>
      </div>
    );
  }
  return (
    <div className="html-preview-pane">
      <HtmlPreviewFrame
        html={payload.html}
        title={payload.title}
        allowScripts
      />
    </div>
  );
}

export function openHtmlPreviewTab(
  wsId: string,
  chatId: string | undefined,
  previewId: string,
  html: string,
  title: string,
): void {
  useStore.getState().openHtmlPreview(wsId, chatId, previewId, html, title);
}
