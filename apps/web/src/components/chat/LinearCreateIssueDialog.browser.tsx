// FILE: LinearCreateIssueDialog.browser.tsx
// Purpose: Browser regressions for Linear cycle selection during issue creation.
// Layer: Focused component integration tests

import "../../index.css";

import type { LinearCreateOptions, LinearIssue, NativeApi } from "@synara/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { LinearCreateIssueDialog } from "./LinearCreateIssueDialog";

const options = {
  workspaces: [
    {
      workspace: { id: "workspace-1", name: "Alek", urlKey: "alekdob" },
      teams: [
        {
          id: "team-a",
          key: "ALE",
          name: "Quack",
          cycles: [
            {
              id: "cycle-a-current",
              number: 12,
              name: "Current work",
              startsAt: "2026-08-10T00:00:00.000Z",
              endsAt: "2026-08-24T00:00:00.000Z",
              isActive: true,
            },
            {
              id: "cycle-a-future",
              number: 13,
              name: null,
              startsAt: "2026-08-24T00:00:00.000Z",
              endsAt: "2026-09-07T00:00:00.000Z",
              isActive: false,
            },
          ],
        },
        {
          id: "team-b",
          key: "OPS",
          name: "Operations",
          cycles: [
            {
              id: "cycle-b-current",
              number: 20,
              name: "Operations now",
              startsAt: "2026-08-17T00:00:00.000Z",
              endsAt: "2026-08-31T00:00:00.000Z",
              isActive: true,
            },
          ],
        },
      ],
      projects: [],
    },
  ],
} satisfies LinearCreateOptions;

const issue = {
  id: "issue-1",
  identifier: "ALE-1",
  title: "Cycle support",
  url: "https://linear.app/alekdob/issue/ALE-1",
  stateName: "Backlog",
  projectName: null,
  workspaceId: "workspace-1",
  workspaceName: "Alek",
  workspaceUrlKey: "alekdob",
} satisfies LinearIssue;

const createIssue = vi.fn(async () => issue);
let restoreNativeApi: (() => void) | null = null;

function installNativeApi(api: NativeApi): () => void {
  const previousDescriptor = Object.getOwnPropertyDescriptor(window, "nativeApi");
  Object.defineProperty(window, "nativeApi", { configurable: true, value: api });
  return () => {
    if (previousDescriptor) Object.defineProperty(window, "nativeApi", previousDescriptor);
    else Reflect.deleteProperty(window, "nativeApi");
  };
}

async function mountDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LinearCreateIssueDialog
        draftTitle="Cycle support"
        projectId={null}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  createIssue.mockClear();
  restoreNativeApi = installNativeApi({
    linear: {
      listCreateOptions: async () => options,
      createIssue,
    },
  } as unknown as NativeApi);
});

afterEach(() => {
  restoreNativeApi?.();
  restoreNativeApi = null;
  document.body.innerHTML = "";
});

describe("LinearCreateIssueDialog cycles", () => {
  it("submits the current cycle by default", async () => {
    const mounted = await mountDialog();

    try {
      await expect.element(page.getByLabelText("Linear cycle")).toHaveTextContent("Current work");
      await page.getByText("Create", { exact: true }).click();

      await vi.waitFor(() =>
        expect(createIssue).toHaveBeenCalledWith(
          expect.objectContaining({ teamId: "team-a", cycleId: "cycle-a-current" }),
        ),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it("allows a future cycle", async () => {
    const mounted = await mountDialog();

    try {
      await page.getByLabelText("Linear cycle").click();
      await page.getByRole("option", { name: "Cycle 13", exact: true }).click();
      await page.getByText("Create", { exact: true }).click();

      await vi.waitFor(() =>
        expect(createIssue).toHaveBeenCalledWith(
          expect.objectContaining({ cycleId: "cycle-a-future" }),
        ),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it("allows no cycle", async () => {
    const mounted = await mountDialog();

    try {
      await page.getByLabelText("Linear cycle").click();
      await page.getByRole("option", { name: "No cycle", exact: true }).click();
      await page.getByText("Create", { exact: true }).click();

      await vi.waitFor(() => expect(createIssue).toHaveBeenCalledOnce());
      expect(createIssue.mock.calls[0]?.[0]).not.toHaveProperty("cycleId");
    } finally {
      await mounted.unmount();
    }
  });

  it("resets to the new team's current cycle", async () => {
    const mounted = await mountDialog();

    try {
      await page.getByLabelText("Linear cycle").click();
      await page.getByRole("option", { name: "Cycle 13", exact: true }).click();
      await page.getByLabelText("Linear team").click();
      await page.getByRole("option", { name: "OPS — Operations", exact: true }).click();

      await expect
        .element(page.getByLabelText("Linear cycle"))
        .toHaveTextContent("Operations now");
      await page.getByText("Create", { exact: true }).click();
      await vi.waitFor(() =>
        expect(createIssue).toHaveBeenCalledWith(
          expect.objectContaining({ teamId: "team-b", cycleId: "cycle-b-current" }),
        ),
      );
    } finally {
      await mounted.unmount();
    }
  });
});
