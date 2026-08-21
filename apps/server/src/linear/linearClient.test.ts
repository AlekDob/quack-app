import { beforeEach, describe, expect, it, vi } from "vitest";

import { outboundHttp } from "@synara/shared/outboundHttp";

import { fetchJson } from "../providerUsage/http";
import {
  createLinearIssue,
  fetchLinearOrganization,
  LinearApiError,
  listLinearCreateOptions,
  searchLinearIssues,
  searchLinearIssuesAcrossWorkspaces,
  uploadLinearFile,
} from "./linearClient";

vi.mock("../providerUsage/http", () => ({ fetchJson: vi.fn() }));
vi.mock("@synara/shared/outboundHttp", () => ({ outboundHttp: { request: vi.fn() } }));

const fetchJsonMock = vi.mocked(fetchJson);

const WORKSPACE = {
  id: "org-1",
  name: "Alek",
  urlKey: "alekdob",
};

function reply(json: unknown, status = 200) {
  fetchJsonMock.mockResolvedValue({ status, ok: status < 300, json, headers: new Headers() });
}

function lastBody(): { query: string; variables: Record<string, unknown> } {
  const call = fetchJsonMock.mock.calls.at(-1)?.[0];
  return call?.body as { query: string; variables: Record<string, unknown> };
}

const ISSUE_NODE = {
  id: "uuid-1",
  identifier: "ALE-28",
  title: "Integrazione linear",
  url: "https://linear.app/alekdob/issue/ALE-28",
  state: { name: "Backlog" },
  project: { name: "Quack" },
};

const ISSUE = {
  id: "uuid-1",
  identifier: "ALE-28",
  title: "Integrazione linear",
  url: "https://linear.app/alekdob/issue/ALE-28",
  stateName: "Backlog",
  projectName: "Quack",
  workspaceId: "org-1",
  workspaceName: "Alek",
  workspaceUrlKey: "alekdob",
};

describe("linearClient", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it("asks Linear to exclude completed and canceled issues", async () => {
    reply({ data: { issues: { nodes: [ISSUE_NODE] } } });

    const issues = await searchLinearIssues("key", "", WORKSPACE);

    expect(lastBody().variables.filter).toEqual({
      state: { type: { nin: ["completed", "canceled"] } },
    });
    expect(issues).toEqual([ISSUE]);
  });

  it("keeps the state filter when searching by term", async () => {
    reply({ data: { searchIssues: { nodes: [ISSUE_NODE] } } });

    const issues = await searchLinearIssues("key", "  ale  ", WORKSPACE);

    expect(lastBody().variables).toMatchObject({
      term: "ale",
      filter: { state: { type: { nin: ["completed", "canceled"] } } },
    });
    expect(issues).toHaveLength(1);
  });

  it("reports a bad API key instead of returning nothing", async () => {
    reply({}, 401);

    await expect(searchLinearIssues("key", "", WORKSPACE)).rejects.toBeInstanceOf(LinearApiError);
  });

  it("surfaces GraphQL errors from a create", async () => {
    reply({ errors: [{ message: "Team not found" }] });

    await expect(
      createLinearIssue("key", WORKSPACE, { workspaceId: "org-1", title: "x", teamId: "t" }),
    ).rejects.toThrow("Team not found");
  });

  it("fan-out search keeps results from a healthy workspace when another key fails", async () => {
    fetchJsonMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: { data: { issues: { nodes: [ISSUE_NODE] } } },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({ status: 401, ok: false, json: {}, headers: new Headers() });

    const issues = await searchLinearIssuesAcrossWorkspaces(
      [
        { workspace: WORKSPACE, apiKey: "good" },
        { workspace: { id: "org-2", name: "Esopo", urlKey: "esopo" }, apiKey: "bad" },
      ],
      "",
    );

    expect(issues).toEqual([ISSUE]);
  });

  it("reads the API-key workspace from organization or viewer.organization", async () => {
    reply({
      data: {
        organization: { id: "org-1", name: "Alek", urlKey: "alekdob" },
        viewer: { organization: null },
      },
    });

    await expect(fetchLinearOrganization("key")).resolves.toEqual(WORKSPACE);
  });

  it("falls back to viewer.organization when the root organization is empty", async () => {
    reply({
      data: {
        organization: null,
        viewer: { organization: { id: "org-1", name: "Alek", urlKey: "alekdob" } },
      },
    });

    await expect(fetchLinearOrganization("key")).resolves.toEqual(WORKSPACE);
  });

  it("lists the active cycle before sorted future cycles and keeps teams without cycles", async () => {
    reply({
      data: {
        teams: {
          nodes: [
            {
              id: "team-1",
              key: "ALE",
              name: "Quack",
              activeCycle: {
                id: "cycle-current",
                number: 12,
                name: "Current work",
                startsAt: "2026-08-10T00:00:00.000Z",
                endsAt: "2026-08-24T00:00:00.000Z",
              },
              futureCycles: {
                nodes: [
                  {
                    id: "cycle-14",
                    number: 14,
                    name: null,
                    startsAt: "2026-09-07T00:00:00.000Z",
                    endsAt: "2026-09-21T00:00:00.000Z",
                  },
                  {
                    id: "cycle-current",
                    number: 12,
                    name: "Duplicate",
                    startsAt: "2026-08-10T00:00:00.000Z",
                    endsAt: "2026-08-24T00:00:00.000Z",
                  },
                  {
                    id: "cycle-13",
                    number: 13,
                    name: "Next",
                    startsAt: "2026-08-24T00:00:00.000Z",
                    endsAt: "2026-09-07T00:00:00.000Z",
                  },
                ],
              },
            },
            {
              id: "team-2",
              key: "OPS",
              name: "Operations",
              activeCycle: null,
              futureCycles: { nodes: [] },
            },
          ],
        },
        projects: { nodes: [] },
      },
    });

    const options = await listLinearCreateOptions("key", WORKSPACE);

    expect(options.teams[0]?.cycles).toEqual([
      {
        id: "cycle-current",
        number: 12,
        name: "Current work",
        startsAt: "2026-08-10T00:00:00.000Z",
        endsAt: "2026-08-24T00:00:00.000Z",
        isActive: true,
      },
      {
        id: "cycle-13",
        number: 13,
        name: "Next",
        startsAt: "2026-08-24T00:00:00.000Z",
        endsAt: "2026-09-07T00:00:00.000Z",
        isActive: false,
      },
      {
        id: "cycle-14",
        number: 14,
        name: null,
        startsAt: "2026-09-07T00:00:00.000Z",
        endsAt: "2026-09-21T00:00:00.000Z",
        isActive: false,
      },
    ]);
    expect(options.teams[1]?.cycles).toEqual([]);
    expect(lastBody().query).toContain("cycles(first: 15");
    expect(lastBody().query).toContain("isFuture: { eq: true }");
  });

  it("sends the selected cycle when creating an issue", async () => {
    reply({ data: { issueCreate: { success: true, issue: ISSUE_NODE } } });

    await createLinearIssue("key", WORKSPACE, {
      workspaceId: "org-1",
      title: "x",
      teamId: "team-1",
      cycleId: "cycle-current",
    });

    expect(lastBody().variables.input).toMatchObject({ cycleId: "cycle-current" });
  });

  it("omits the cycle when none is selected", async () => {
    reply({ data: { issueCreate: { success: true, issue: ISSUE_NODE } } });

    await createLinearIssue("key", WORKSPACE, {
      workspaceId: "org-1",
      title: "x",
      teamId: "team-1",
    });

    expect(lastBody().variables.input).not.toHaveProperty("cycleId");
  });

  describe("uploadLinearFile", () => {
    const FILE = { name: "shot.png", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) };

    function replyUpload(uploadUrl: string) {
      reply({
        data: {
          fileUpload: {
            success: true,
            uploadFile: {
              uploadUrl,
              assetUrl: "https://uploads.linear.app/asset/1",
              headers: [{ key: "x-goog-content-length-range", value: "0,3" }],
            },
          },
        },
      });
    }

    it("rejects an upload URL on an unexpected host", async () => {
      replyUpload("https://evil.example.com/put");

      await expect(uploadLinearFile("key", FILE)).rejects.toBeInstanceOf(LinearApiError);
      expect(vi.mocked(outboundHttp.request)).not.toHaveBeenCalled();
    });

    it("PUTs the bytes with every returned header and returns the asset URL", async () => {
      replyUpload("https://storage.googleapis.com/bucket/obj?sig=1");
      vi.mocked(outboundHttp.request).mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: new Uint8Array(),
        url: "https://storage.googleapis.com/bucket/obj",
      });

      await expect(uploadLinearFile("key", FILE)).resolves.toBe(
        "https://uploads.linear.app/asset/1",
      );
      const call = vi.mocked(outboundHttp.request).mock.calls.at(-1)?.[0];
      expect(call?.method).toBe("PUT");
      expect(call?.headers).toEqual({
        "Content-Type": "image/png",
        "x-goog-content-length-range": "0,3",
      });
    });
  });
});
