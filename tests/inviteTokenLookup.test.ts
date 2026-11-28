import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { generateInviteToken, hashInviteToken, lookupPendingInviteByToken } from "../lib/inviteTokenLookup";

const now = new Date("2026-01-01T00:00:00Z");
const token = "synthetic-token-for-ci-only";
const invite = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "reader@invalid.test",
  invited_role: "reader",
  invited_by_user_id: null,
  status: "pending",
  expires_at: "2026-01-02T00:00:00Z",
};

function mockClient(rows: unknown[], status = 200) {
  const calls: URL[] = [];
  const mockFetch: typeof fetch = async (input) => {
    calls.push(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url));
    return new Response(JSON.stringify(status === 200 ? rows : {
      code: "CI_TEST_ERROR", message: "Synthetic failure",
    }), { status, headers: { "content-type": "application/json" } });
  };
  return {
    client: createClient("https://example.invalid", "synthetic-ci-key", {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: mockFetch },
    }),
    calls,
  };
}

test("generated token has stable hash and independent randomness", () => {
  const generated = generateInviteToken();
  assert.match(generated, /^[A-Za-z0-9_-]{32}$/);
  assert.match(hashInviteToken(generated), /^[a-f0-9]{64}$/);
  assert.equal(hashInviteToken(generated), hashInviteToken(generated));
  assert.notEqual(generated, generateInviteToken());
});

test("bearer lookup requests only the hashed, pending, unexpired target and returns a minimal projection", async () => {
  const { client, calls } = mockClient([{ ...invite, token_hash: "not-returned", note: "not-returned" }]);
  assert.deepEqual(await lookupPendingInviteByToken(client, token, now), invite);
  assert.equal(calls.length, 1);
  const url = calls[0];
  assert.equal(url.pathname, "/rest/v1/invites");
  assert.equal(url.searchParams.get("token_hash"), "eq." + hashInviteToken(token));
  assert.equal(url.searchParams.get("status"), "eq.pending");
  assert.equal(url.searchParams.get("or"), "(expires_at.is.null,expires_at.gt." + now.toISOString() + ")");
  assert.equal(url.searchParams.get("select"), "id,email,invited_role,invited_by_user_id,status,expires_at");
  assert.ok(!url.href.includes(token));
});

test("unknown, duplicate, non-pending and expired lookup results fail closed", async () => {
  for (const rows of [[], [invite, invite], [{ ...invite, status: "revoked" }],
    [{ ...invite, status: "accepted" }], [{ ...invite, expires_at: now.toISOString() }],
    [{ ...invite, expires_at: "invalid" }]]) {
    const { client } = mockClient(rows);
    assert.equal(await lookupPendingInviteByToken(client, token, now), null);
  }
  const { client } = mockClient([{ ...invite, expires_at: null }]);
  assert.equal((await lookupPendingInviteByToken(client, token, now))?.expires_at, null);
});

test("invalid inputs avoid network access and failed lookup is not authorized", async () => {
  const { client, calls } = mockClient([]);
  for (const value of ["", "a".repeat(257)]) assert.equal(await lookupPendingInviteByToken(client, value, now), null);
  assert.equal(await lookupPendingInviteByToken(client, token, new Date("invalid")), null);
  assert.equal(calls.length, 0);
  assert.equal(await lookupPendingInviteByToken(mockClient([], 403).client, token, now), null);
});
