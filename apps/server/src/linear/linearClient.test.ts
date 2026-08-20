import { beforeEach, describe, expect, it, vi } from "vitest";

import { outboundHttp } from "@synara/shared/outboundHttp";

import { fetchJson } from "../providerUsage/http";
import {
  createLinearIssue,
  fetchLinearOrganization,
  LinearApiError,
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
