import { useEffect, useMemo, useState } from "react";
import {
  commitKey,
  getAgentCommit,
  markAgentCommitPushed,
  subscribeAgentCommit,
} from "../agentCommitStore";
import {
  forceGitStatusRefresh,
  getGitStatus,
  startGitStatusWatch,
  subscribeGitStatus,
} from "../gitStatusStore";
import { Icon } from "./Icon";

type Props = { wsId: string; sessionId: string; root: string };

function formatCommitTime(atMs: number): string {
  const ago = (Date.now() - atMs) / 1000;
  if (ago < 60) return "just now";
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  return new Date(atMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentCommitDock({ wsId, sessionId, root }: Props) {
  const key = commitKey(wsId, sessionId);
  const [, tick] = useState(0);
  const [gitTick, setGitTick] = useState(0);

  useEffect(() => subscribeAgentCommit(() => tick((n) => n + 1)), []);

  useEffect(() => {
    const apply = () => setGitTick((n) => n + 1);
    const stop = startGitStatusWatch(wsId, root);
    const unsub = subscribeGitStatus(wsId, apply);
    apply();
    return () => {
      unsub();
      stop();
    };
  }, [wsId, root]);

  const commit = getAgentCommit(key);
  const gitStatus = getGitStatus(wsId).status;
  void gitTick;

  const ahead = gitStatus?.ahead ?? 0;
  const hasUpstream = !!gitStatus?.upstream;

  const pushed = useMemo(() => {
    if (!commit) return false;
    if (commit.pushed) return true;
    if (!hasUpstream) return false;
    return ahead === 0;
  }, [commit, hasUpstream, ahead]);

  useEffect(() => {
    if (!commit || commit.pushed || !hasUpstream || ahead !== 0) return;
    markAgentCommitPushed(key);
  }, [commit, hasUpstream, ahead, key]);

  useEffect(() => {
    if (!commit || commit.pushed) return;
    const id = window.setInterval(() => void forceGitStatusRefresh(wsId), 8000);
    return () => window.clearInterval(id);
  }, [commit, wsId]);

  if (!commit) return null;

  const pushTitle = pushed
    ? "Pushed to remote"
    : !hasUpstream
      ? "No upstream — not pushed"
      : ahead > 0
        ? `${ahead} commit${ahead === 1 ? "" : "s"} not pushed yet`
        : "Not pushed yet";

  return (
    <div className="ai-commit-dock" aria-live="polite">
      <div className="ai-commit-dock-pill" title={commit.message}>
        <span className="ai-commit-dock-ico" aria-hidden="true">
          <Icon name="git-branch" size={12} />
        </span>
        {commit.shortHash ? (
          <span className="ai-commit-dock-hash">{commit.shortHash}</span>
        ) : null}
        <span className="ai-commit-dock-msg">{commit.message}</span>
        <span className="ai-commit-dock-time">{formatCommitTime(commit.at)}</span>
        <span
          className={`ai-commit-dock-push${pushed ? " is-pushed" : " is-local"}`}
          title={pushTitle}
        >
          <Icon name={pushed ? "upload-cloud" : "cloud"} size={12} />
          <span>{pushed ? "Pushed" : hasUpstream && ahead > 0 ? `↑${ahead}` : "Local"}</span>
        </span>
      </div>
    </div>
  );
}
