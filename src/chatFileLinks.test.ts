import { describe, expect, it } from "vitest";
import { enrichMarkdownWithFileLinks } from "./chatFileLinks";

describe("enrichMarkdownWithFileLinks", () => {
  it("wraps absolute Unix paths as md-file-link", () => {
    const abs = "/Users/alekdob/Downloads/proposta.pdf";
    const html = enrichMarkdownWithFileLinks(`<p>see ${abs} please</p>`);
    expect(html).toContain(`data-file-link="${abs}"`);
    expect(html).toContain('class="md-file-link"');
  });

  it("still wraps relative bare paths", () => {
    const html = enrichMarkdownWithFileLinks("<p>open docs/foo.md now</p>");
    expect(html).toContain('data-file-link="docs/foo.md"');
  });

  it("wraps absolute paths inside code spans", () => {
    const abs = "/tmp/out.pdf";
    const html = enrichMarkdownWithFileLinks(`<p><code>${abs}</code></p>`);
    expect(html).toContain(`data-file-link="${abs}"`);
  });
});
