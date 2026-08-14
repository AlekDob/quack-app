import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "../providerUsage/http";
import { createLinearIssue, LinearApiError, searchLinearIssues } from "./linearClient";

vi.mock("../providerUsage/http", () => ({ fetchJson: vi.fn() }));

const fetchJsonMock = vi.mocked(fetchJson);

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

describe("linearClient", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it("asks Linear to exclude completed and canceled issues", async () => {
    reply({ data: { issues: { nodes: [ISSUE_NODE] } } });

    const issues = await searchLinearIssues("key", "");

    expect(lastBody().variables.filter).toEqual({
      state: { type: { nin: ["completed", "canceled"] } },
    });
    expect(issues).toEqual([
      {
        id: "uuid-1",
        identifier: "ALE-28",
        title: "Integrazione linear",
        url: "https://linear.app/alekdob/issue/ALE-28",
        stateName: "Backlog",
        projectName: "Quack",
      },
    ]);
  });

  it("keeps the state filter when searching by term", async () => {
    reply({ data: { searchIssues: { nodes: [ISSUE_NODE] } } });

    const issues = await searchLinearIssues("key", "  ale  ");

    expect(lastBody().variables).toMatchObject({
      term: "ale",
      filter: { state: { type: { nin: ["completed", "canceled"] } } },
    });
    expect(issues).toHaveLength(1);
  });

  it("reports a bad API key instead of returning nothing", async () => {
    reply({}, 401);

    await expect(searchLinearIssues("key", "")).rejects.toBeInstanceOf(LinearApiError);
  });

  it("surfaces GraphQL errors from a create", async () => {
    reply({ errors: [{ message: "Team not found" }] });

    await expect(createLinearIssue("key", { title: "x", teamId: "t" })).rejects.toThrow(
      "Team not found",
    );
  });
});
