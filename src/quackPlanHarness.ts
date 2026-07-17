// Quack-owned plan harness — story artifact, provider adapters optional.

import { useStore } from "./store";
import { findStory, findWork } from "./works";
import {
  approvePlanStory,
  createWorkFromStory,
  ensurePlanStory,
  hydrateWorks,
  linkChatToStory,
  linkChatToWork,
  mergePlanIntoStory,
  unlinkChatFromStory,
  unlinkChatFromWork,
} from "./worksCache";
import type { WorkItem } from "./works";
import { openStoryPlanTab } from "./components/StoryPlanPane";
import type { WorkStory } from "./works";
import { openFeatureDocDrawer } from "./featureDocDrawer";
import { mergePlanIntoFeature } from "./planFeatureMerge";
import { FEATURE_DIR } from "./worksFeatureModules";
import { featureLabelFromSlug } from "./featureCatalog";

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
  const featureId = useStore.getState().loaded[wsId]?.aiChats[chatId]?.featureId;
  if (featureId) {
    await mergePlanIntoFeature(root, featureId, planText);
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: featureId.includes("/")
        ? featureId
        : `${FEATURE_DIR}/${featureId}.md`,
      title: featureLabelFromSlug(featureId),
    });
    return;
  }
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

/** Approve the story plan, spawn `W-NNN`, and link it — Cursor-style handoff
 *  target before switching the composer to Milo (Builder). */
export async function handoffStoryToBuilder(
  wsId: string,
  chatId: string,
  root: string,
  storyId: string,
  planText?: string,
): Promise<WorkItem | null> {
  const snap = await hydrateWorks(root);
  const story = findStory(snap, storyId);
  if (!story) return null;

  const plan = planText?.trim() || story.bodyMd || "";
  let title = story.title;
  if (story.status === "draft") {
    const approved = await approvePlanning(wsId, chatId, root, storyId, plan);
    if (approved) title = approved.title;
  } else {
    useStore.getState().setAIChatPlanning(wsId, chatId, false);
  }

  const item = await createWorkFromStory(root, storyId, { title });
  if (!item) return null;
  await linkWorkToChat(wsId, chatId, root, item.id);
  return item;
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

export async function linkWorkToChat(
  wsId: string,
  chatId: string,
  root: string,
  workId: string,
): Promise<void> {
  await linkChatToWork(root, workId, chatId);
  const snap = await hydrateWorks(root);
  const parentId = findWork(snap, workId)?.parentId;
  const store = useStore.getState();
  store.setAIChatWorkItem(wsId, chatId, workId);
  store.setAIChatPlanning(wsId, chatId, false);
  store.setAIChatStory(wsId, chatId, parentId ?? null);
}

export async function linkStoryToChat(
  wsId: string,
  chatId: string,
  root: string,
  storyId: string,
): Promise<void> {
  await linkChatToStory(root, storyId, chatId);
  const snap = await hydrateWorks(root);
  const story = findStory(snap, storyId);
  const store = useStore.getState();
  store.setAIChatWorkItem(wsId, chatId, null);
  store.setAIChatStory(wsId, chatId, storyId);
  store.setAIChatPlanning(wsId, chatId, story?.status === "draft");
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
