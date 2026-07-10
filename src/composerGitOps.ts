import { confirm as dialogConfirm, prompt as dialogPrompt } from "./dialog";
import { git, type GitFile, type GitStatus } from "./ipc";
import { forceGitStatusRefresh } from "./gitStatusStore";
import { error as toastError, errMsg, success as toastSuccess } from "./notify";

export type ComposerGitAction =
  | "commit"
  | "commit-push"
  | "push"
  | "branch-commit"
  | "branch-commit-push";

async function stageAll(root: string, files: GitFile[]): Promise<void> {
  const paths = files.filter((f) => !f.conflicted).map((f) => f.path);
  if (paths.length === 0) return;
  await git.stage(root, paths);
}

async function askCommitMessage(suggested?: string): Promise<string | null> {
  const msg = await dialogPrompt("Commit message", suggested ?? "", {
    title: "Commit changes",
    okLabel: "Commit",
  });
  const trimmed = msg?.trim();
  return trimmed ? trimmed : null;
}

async function askBranchName(): Promise<string | null> {
  const name = await dialogPrompt("New branch name", "", {
    title: "Create branch",
    okLabel: "Create",
  });
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

async function pushWithPublish(root: string, status: GitStatus): Promise<boolean> {
  const publish = async (): Promise<boolean> => {
    const ok = await dialogConfirm(
      `${status.branch ?? "This branch"} has no upstream yet. Publish it to origin?`,
      { title: "Publish branch", okLabel: "Publish", cancelLabel: "Cancel" },
    );
    if (!ok) return false;
    try {
      await git.push(root, true);
      toastSuccess(`Published ${status.branch ?? "branch"} to origin`);
      return true;
    } catch (e) {
      toastError(`Publish failed: ${errMsg(e)}`);
      return false;
    }
  };
  if (!status.upstream) return publish();
  try {
    await git.push(root);
    toastSuccess("Pushed to remote");
    return true;
  } catch (e) {
    const msg = errMsg(e);
    if (/no upstream branch/i.test(msg)) return publish();
    toastError(`Push failed: ${msg}`);
    return false;
  }
}

async function commitStaged(root: string, message: string): Promise<boolean> {
  try {
    await git.commit(root, message);
    toastSuccess("Committed");
    return true;
  } catch (e) {
    toastError(`Commit failed: ${errMsg(e)}`);
    return false;
  }
}

export async function runComposerGitAction(opts: {
  wsId: string;
  root: string;
  status: GitStatus;
  action: ComposerGitAction;
  suggestedMessage?: string;
}): Promise<void> {
  const { wsId, root, status, action, suggestedMessage } = opts;
  const needsCommit = action !== "push";
  const needsPush =
    action === "commit-push" ||
    action === "branch-commit-push" ||
    action === "push";
  const needsBranch =
    action === "branch-commit" || action === "branch-commit-push";

  if (needsBranch) {
    const branch = await askBranchName();
    if (!branch) return;
    try {
      await git.createBranch(root, branch, undefined, true);
      toastSuccess(`Created branch ${branch}`);
    } catch (e) {
      toastError(`Create branch failed: ${errMsg(e)}`);
      return;
    }
  }

  if (needsCommit) {
    await stageAll(root, status.files);
    const message = await askCommitMessage(suggestedMessage);
    if (!message) return;
    const ok = await commitStaged(root, message);
    if (!ok) return;
  }

  if (needsPush) {
    const fresh = (await git.status(root)) as GitStatus;
    await pushWithPublish(root, fresh);
  }

  await forceGitStatusRefresh(wsId);
}
