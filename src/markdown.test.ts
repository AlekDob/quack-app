import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown fences", () => {
  it("keeps > lines inside a Cursor citation fence as code, not callouts", () => {
    const md = [
      "```70:77:raycast-extension/src/chat.tsx",
      't.role === "user" ? `> **Tu**',
      "",
      "> ${t.text}` : bot(t.text, t.agent),",
      "```",
    ].join("\n");
    const html = renderMarkdown(md);
    expect(html).toContain("md-code-block");
    expect(html).toContain('class="lang-tsx"');
    expect(html).toContain("&gt; **Tu**");
    expect(html).toContain("&gt; ${t.text}");
    expect(html).not.toContain("md-callout");
  });

  it("still renders real blockquotes outside fences", () => {
    const html = renderMarkdown("> **Tu**\n\n> hello");
    expect(html).toContain("md-callout");
    expect(html).toContain("<strong>Tu</strong>");
  });

  it("accepts c++ as a fence language", () => {
    const html = renderMarkdown("```c++\nint x = 1;\n```");
    expect(html).toContain('class="lang-c++"');
    expect(html).toContain("int x = 1;");
  });
});
