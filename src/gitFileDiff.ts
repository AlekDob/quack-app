import { requestDiff } from "./editorState";
import { langOf } from "./langDetect";
import { error as toastError, errMsg } from "./notify";
import { joinPath } from "./pathUtils";
import { fs, git as gitApi, type GitFile } from "./ipc";

/** Open the global DiffModal for a git file (same path as Source Control). */
export async function openGitFileDiff(
  root: string,
  f: GitFile,
): Promise<void> {
  const abs = joinPath(root, f.path);
  try {
    const original = await gitApi.show(root, "HEAD", f.path);
    const modified = f.staged
      ? await gitApi.show(root, "", f.path)
      : await fs.readFile(abs);
    requestDiff({
      path: f.path,
      refspec: f.staged ? "HEAD vs index" : "HEAD vs working tree",
      originalContent: original,
      modifiedContent: modified,
      language: langOf(f.path),
    });
  } catch (e) {
    toastError(`Diff failed: ${errMsg(e)}`);
  }
}
