import { createHash } from "node:crypto";
import {
  inspectSourceIntegrity, recomposeFixtureRegion, type AnchoredBlock,
} from "../fixtures/ingestComposer";
import type { GutenbergPilot } from "./gutenbergSnapshot";

export type RevisionBoundIssue = {
  schema: "artales.composer.revision-issue.v1";
  issue_id: string;
  round: number;
  block_id: string;
  category: "typography" | "structure" | "readability" | "line_break" | "pagination";
  reason: string;
  snapshot_ref: string;
  parent_revision_ref: string;
  parent_revision_sha256: string;
  source_anchor: { component_id: string; start: number; end: number; original_byte_start: number; original_byte_end: number };
  status: "returned_for_changes";
};
export type ComposerRevision = {
  schema: "artales.composer.immutable-revision.v1";
  work_revision_ref: string;
  bytes_sha256: string;
  snapshot_ref: string;
  parent_revision_ref: string | null;
  round: number;
  blocks: AnchoredBlock[];
  issues: RevisionBoundIssue[];
  state: "draft" | "submitted_for_review";
  release_allowed: false;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const cloneBlocks = (blocks: AnchoredBlock[]) => structuredClone(blocks);
function revision(pilot: GutenbergPilot, blocks: AnchoredBlock[], parent: string | null,
  round: number, issues: RevisionBoundIssue[], state: ComposerRevision["state"]): ComposerRevision {
  const bytes_sha256 = digest({
    snapshot_ref: pilot.snapshot_ref, parent_revision_ref: parent,
    blocks, issues, round, state,
  });
  return {
    schema: "artales.composer.immutable-revision.v1",
    work_revision_ref: "sha256:" + bytes_sha256,
    bytes_sha256, snapshot_ref: pilot.snapshot_ref, parent_revision_ref: parent,
    round, blocks: cloneBlocks(blocks), issues: structuredClone(issues),
    state, release_allowed: false,
  };
}
function verify(pilot: GutenbergPilot, candidate: ComposerRevision) {
  if (candidate.snapshot_ref !== pilot.snapshot_ref ||
      candidate.schema !== "artales.composer.immutable-revision.v1" ||
      candidate.work_revision_ref !== "sha256:" + candidate.bytes_sha256 ||
      !inspectSourceIntegrity(pilot.capture, candidate.blocks).ok ||
      candidate.bytes_sha256 !== digest({
        snapshot_ref: pilot.snapshot_ref, parent_revision_ref: candidate.parent_revision_ref,
        blocks: candidate.blocks, issues: candidate.issues, round: candidate.round, state: candidate.state,
      })) throw new Error("Tampered or unrelated immutable composer revision.");
  // The original source byte anchors are independent of page layout and cannot move.
  for (const block of candidate.blocks) {
    const pinned = pilot.blocks.find((item) => item.block.id === block.block.id);
    if (!pinned || pinned.start !== block.start || pinned.end !== block.end ||
        pinned.componentId !== block.componentId || pinned.block.content !== block.block.content) {
      throw new Error("Composer ancestry/source anchor changed.");
    }
  }
}
export function createInitialRevision(pilot: GutenbergPilot): ComposerRevision {
  if (!pilot.qa.ok || !pilot.blocks.length) throw new Error("Cannot draft an invalid pilot.");
  return revision(pilot, pilot.blocks, null, 0, [], "submitted_for_review");
}
export function returnIssue(pilot: GutenbergPilot, current: ComposerRevision,
  args: { issue_id: string; block_id: string; category: RevisionBoundIssue["category"]; reason: string }
): RevisionBoundIssue {
  verify(pilot, current);
  if (current.state !== "submitted_for_review" || current.issues.length) {
    throw new Error("Only a submitted clean revision can be returned.");
  }
  const target = pilot.blocks.find((x) => x.block.id === args.block_id);
  if (!target || args.reason.trim().length < 3 || args.reason.length > 1000 ||
      !/^[a-zA-Z0-9:_-]{3,128}$/.test(args.issue_id)) {
    throw new Error("Invalid issue anchor, reason or identifier.");
  }
  return {
    schema: "artales.composer.revision-issue.v1",
    issue_id: args.issue_id, round: current.round + 1, block_id: args.block_id,
    category: args.category, reason: args.reason.trim(),
    snapshot_ref: pilot.snapshot_ref, parent_revision_ref: current.work_revision_ref,
    parent_revision_sha256: current.bytes_sha256,
    source_anchor: {
      component_id: target.componentId, start: target.start, end: target.end,
      original_byte_start: target.original.byte_start, original_byte_end: target.original.byte_end,
    },
    status: "returned_for_changes",
  };
}
export function applyReturnedIssue(pilot: GutenbergPilot, current: ComposerRevision,
  issue: RevisionBoundIssue): ComposerRevision {
  verify(pilot, current);
  const target = pilot.blocks.find((x) => x.block.id === issue.block_id);
  if (current.state !== "submitted_for_review" || current.issues.length ||
      issue.parent_revision_ref !== current.work_revision_ref ||
      issue.parent_revision_sha256 !== current.bytes_sha256 ||
      issue.snapshot_ref !== pilot.snapshot_ref || issue.round !== current.round + 1 ||
      !target || issue.source_anchor.component_id !== target.componentId ||
      issue.source_anchor.start !== target.start || issue.source_anchor.end !== target.end ||
      issue.source_anchor.original_byte_start !== target.original.byte_start ||
      issue.source_anchor.original_byte_end !== target.original.byte_end) {
    throw new Error("Stale or modified reviewer packet.");
  }
  const changed = recomposeFixtureRegion(pilot.capture, current.blocks, issue.block_id);
  if (JSON.stringify(changed) === JSON.stringify(current.blocks)) {
    throw new Error("No available bounded layout change. Return to manual editorial review.");
  }
  for (let index = 0; index < changed.length; index++) {
    if (changed[index].block.id !== issue.block_id &&
        JSON.stringify(changed[index]) !== JSON.stringify(current.blocks[index])) {
      throw new Error("Untargeted block changed.");
    }
  }
  return revision(pilot, changed, current.work_revision_ref, issue.round,
    [issue], "submitted_for_review");
}
export function acceptAfterReview(pilot: GutenbergPilot, old: ComposerRevision,
  candidate: ComposerRevision, issue: RevisionBoundIssue) {
  verify(pilot, old); verify(pilot, candidate);
  if (candidate.parent_revision_ref !== old.work_revision_ref ||
      candidate.issues.length !== 1 ||
      JSON.stringify(candidate.issues[0]) !== JSON.stringify(issue) ||
      candidate.round !== old.round + 1 || candidate.state !== "submitted_for_review") {
    throw new Error("Wrong parent, unresolved reviewer packet or stale revision.");
  }
  return {
    schema: "artales.composer.review-decision.v1" as const,
    decision: "accepted_for_fixture_only" as const,
    issue_id: issue.issue_id,
    reviewed_revision_ref: candidate.work_revision_ref,
    reviewed_revision_sha256: candidate.bytes_sha256,
    parent_revision_ref: old.work_revision_ref,
    source_snapshot_ref: pilot.snapshot_ref,
    release_allowed: false as const,
  };
}
