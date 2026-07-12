// Quack-owned plan harness — story artifact, provider adapters optional.

import { useStore } from "./store";
import {
  approvePlanStory,
  ensurePlanStory,
  mergePlanIntoStory,
  unlinkChatFromStory,
  unlinkChatFromWork,
} from "./worksCache";
import { openStoryPlanTab } from "./components/StoryPlanPane";
import type { WorkStory } from "./works";

export async function enterPlanning(
  wsId: string,
  chatId: string,
  root: string,
  title?: string,
): Promise<WorkStory> {
  const story = await ensurePlanStory(root, chatId, title);
  const store = useStore.getState();
  store.setAIChatStory(wsId, chatId, story.id);
  store.setAIChatPlanning(wsId, chatId, true);
  openStoryPlanTab(wsId, chatId, story.id);
  return story;
}

export async function onNativePlanReady(
  wsId: string,
  chatId: string,
  root: string,
  storyId: string,
  planText: string,
): Promise<void> {
  await mergePlanIntoStory(root, storyId, planText);
  openStoryPlanTab(wsId, chatId, storyId);
}

export async function approvePlanning(
  wsId: string,
  chatId: string,
  root: string,
  storyId: string,
  planText: string,
): Promise<WorkStory | null> {
  const story = await approvePlanStory(root, storyId, planText);
  useStore.getState().setAIChatPlanning(wsId, chatId, false);
  return story;
}

export async function exitPlanning(
  wsId: string,
  chatId: string,
  root: string,
  storyId?: string,
): Promise<void> {
  useStore.getState().setAIChatPlanning(wsId, chatId, false);
  if (storyId) await unlinkChatFromStory(root, storyId, chatId);
}

export async function unlinkWorkFromChat(
  wsId: string,
  chatId: string,
  root: string,
  workId: string,
): Promise<void> {
  await unlinkChatFromWork(root, workId, chatId);
  useStore.getState().setAIChatWorkItem(wsId, chatId, null);
}

export async function unlinkStoryFromChat(
  wsId: string,
  chatId: string,
  root: string,
  storyId: string,
): Promise<void> {
  await unlinkChatFromStory(root, storyId, chatId);
  const store = useStore.getState();
  store.setAIChatStory(wsId, chatId, null);
  store.setAIChatPlanning(wsId, chatId, false);
}

const PLAN_HINT_RE =
  /\b(plan|design|architect|roadmap|how should we|approach for|break down)\b/i;

export function shouldSuggestPlanning(
  text: string,
  hasStory: boolean,
  hasWork: boolean,
): boolean {
  if (hasStory || hasWork) return false;
  const t = text.trim();
  if (t.length < 24) return false;
  return PLAN_HINT_RE.test(t) || t.split(/\s+/).length > 18;
}
