import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseEconomicRequestId } from "../lib/economicRequest";

test("form-issued request keys survive replay and reject invalid values", () => {
  const key = randomUUID();
  assert.equal(parseEconomicRequestId(key), key);
  assert.equal(parseEconomicRequestId(key.toUpperCase()), key);
  assert.equal(parseEconomicRequestId(null), null);
  assert.equal(parseEconomicRequestId(""), null);
  assert.equal(parseEconomicRequestId("not-a-uuid"), null);
  assert.equal(parseEconomicRequestId("00000000-0000-0000-0000-000000000000"), null);
  assert.equal(parseEconomicRequestId(new File(["key"], "key.txt")), null);
  assert.notEqual(randomUUID(), key);
});
