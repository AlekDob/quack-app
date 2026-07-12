// Story plan — virtual tab keyed to a Works story on disk (persistent).

export function storyPlanKey(
  wsId: string,
  chatId: string | undefined,
  storyId: string,
): string {
  return `story:${wsId}|${chatId ?? "_"}|${storyId}`;
}

export function parseStoryPlanKey(
  k: string,
): { wsId: string; chatId: string | undefined; storyId: string } | null {
  if (!k.startsWith("story:")) return null;
  const body = k.slice(6);
  let i = 0;
  const take = (): string | null => {
    const j = body.indexOf("|", i);
    if (j < 0) return null;
    const s = body.slice(i, j);
    i = j + 1;
    return s;
  };
  const wsId = take();
  const chatRaw = take();
  const storyId = body.slice(i);
  if (!wsId || !chatRaw || !storyId) return null;
  return { wsId, chatId: chatRaw === "_" ? undefined : chatRaw, storyId };
}
