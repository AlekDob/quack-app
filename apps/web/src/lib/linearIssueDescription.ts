// FILE: linearIssueDescription.ts
// Purpose: Builds the Linear issue markdown body from the typed text plus uploaded images.
// Layer: Web data access

/**
 * `issueCreate` has no image field, so uploaded images are appended to the body as
 * markdown — exactly what Linear itself writes when you paste into a description.
 */
export function buildLinearIssueDescription(
  text: string,
  images: ReadonlyArray<{ readonly name: string; readonly assetUrl: string }>,
): string {
  const parts = [text.trim(), ...images.map((image) => `![${image.name}](${image.assetUrl})`)];
  return parts.filter((part) => part.length > 0).join("\n\n");
}
