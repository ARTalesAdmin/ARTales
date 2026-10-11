import { createHash } from "node:crypto";
import { composeFixtureSection, inspectSourceIntegrity, type AnchoredBlock, type FixtureCapture } from "../fixtures/ingestComposer";

/**
 * Server/test-only, read-only Gutenberg ingest. Never import this module into a
 * client component: the original UTF-8 bytes and provenance stay server-side.
 * No database, rights approval, publication, or production fetch is performed.
 */
export const PG11_COMMIT = "7f18748e114b994d5d9454d5793581bc0b9cf9d7";
export const PG11_URI =
  "https://raw.githubusercontent.com/GITenberg/Alice-s-Adventures-in-Wonderland_11/" +
  PG11_COMMIT + "/11-0.txt";
export const PG11_BYTES_SHA256 = "49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094";
export const PG11_GIT_BLOB_SHA1 = "0f25e9af379233267a09623e0c650472f9e463ea";
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export type CaptureRequest = {
  candidate_id: string;
  candidate_source_id: string;
  source_uri: string;
  retrieval_method: "gitenberg_pinned_git_revision" | "synthetic_fixture_bytes";
  expected_bytes_sha256: string;
  capture_time: string;
  jurisdiction: string;
  rights_dossier_ref: string;
};
export type ImmutableSourceSnapshot = Readonly<{
  source_uri: string;
  retrieval_method: CaptureRequest["retrieval_method"];
  bytes_sha256: string;
  snapshot_ref: string;
  bytes_length: number;
  capture_time: string;
  raw_utf8: string; // exact archived bytes decoded as UTF-8, including BOM and CRLF
  candidate_id: string;
  candidate_source_id: string;
  jurisdiction: string;
  rights_dossier_ref: string;
}>;
export type OriginalByteSpan = {
  byte_start: number;
  byte_end: number; // original raw UTF-8 [start, end)
  first_line: number; // 1-based
  last_line: number; // 1-based, inclusive
};
export type ComponentDisposition = "qa_text_only" | "exclude" | "manual_review";
export type GutenbergComponent = {
  id: string;
  kind: "WORK_CONTENT" | "SOURCE_WRAPPER" | "EDITION_CONTENT" | "TRANSLATION" | "ASSET";
  label: string;
  disposition: ComponentDisposition;
  original: OriginalByteSpan | null; // null = externally linked but not fetched
  reason: string;
};
export type BoundaryResult = {
  status: "ready_for_fixture" | "needs_boundary_review";
  review_reasons: string[];
  content_components: GutenbergComponent[];
};
export type OriginalAnchoredBlock = AnchoredBlock & {
  original: OriginalByteSpan & { snapshot_ref: string; bytes_sha256: string };
};
export type GutenbergPilot = {
  capture: FixtureCapture;
  blocks: OriginalAnchoredBlock[];
  excluded: GutenbergComponent[];
  qa: ReturnType<typeof inspectSourceIntegrity>;
  snapshot_ref: string;
  source_bytes_sha256: string;
  releaseAllowed: false;
  boundaryReview: string[];
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const validIso = (value: string) =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function captureGutenbergBytes(bytes: Uint8Array, request: CaptureRequest): ImmutableSourceSnapshot {
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error("Source byte size out of bounds.");
  if (!validIso(request.capture_time) || !/^[0-9a-f]{64}$/.test(request.expected_bytes_sha256)) {
    throw new Error("Invalid source hash or capture timestamp.");
  }
  if (!request.candidate_id.trim() || !request.candidate_source_id.trim() ||
      !request.rights_dossier_ref.trim() || !request.jurisdiction.trim()) {
    throw new Error("Missing candidate, edition, territorial rights dossier or capture identity.");
  }
  if (request.retrieval_method === "gitenberg_pinned_git_revision" &&
      (request.source_uri !== PG11_URI || request.expected_bytes_sha256 !== PG11_BYTES_SHA256)) {
    throw new Error("Pinned source URL/hash mismatch. Never silently use a new edition.");
  }
  if (request.retrieval_method === "synthetic_fixture_bytes" &&
      !request.source_uri.startsWith("fixture:")) {
    throw new Error("Synthetic bytes require a fixture URI.");
  }
  const digest = sha256(bytes);
  if (digest !== request.expected_bytes_sha256) throw new Error("Source SHA-256 mismatch.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (Buffer.compare(Buffer.from(text, "utf8"), Buffer.from(bytes)) !== 0) {
    throw new Error("Source not exactly representable as UTF-8.");
  }
  return Object.freeze({
    candidate_id: request.candidate_id,
    candidate_source_id: request.candidate_source_id,
    source_uri: request.source_uri,
    retrieval_method: request.retrieval_method,
    bytes_sha256: digest,
    snapshot_ref: "sha256:" + digest,
    bytes_length: bytes.length,
    capture_time: request.capture_time,
    jurisdiction: request.jurisdiction,
    rights_dossier_ref: request.rights_dossier_ref,
    raw_utf8: text,
  });
}

/** One exact, pinned third-party archival Git blob: never crawl Gutenberg pages. */
export async function retrievePinnedPg11(
  request: CaptureRequest,
  fetcher: typeof fetch = fetch,
): Promise<ImmutableSourceSnapshot> {
  if (request.source_uri !== PG11_URI || request.retrieval_method !== "gitenberg_pinned_git_revision" ||
      request.expected_bytes_sha256 !== PG11_BYTES_SHA256) {
    throw new Error("Remote acquisition is restricted to the pinned PG #11 archival blob.");
  }
  const response = await fetcher(PG11_URI, {
    method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { Accept: "text/plain" },
  });
  if (!response.ok || response.status !== 200 || response.redirected ||
      (response.url && response.url !== PG11_URI) || !response.body) {
    throw new Error("Pinned mirror fetch refused (status/redirect/body).");
  }
  const length = Number(response.headers.get("content-length") || "0");
  if (!Number.isSafeInteger(length) || length > MAX_SOURCE_BYTES) {
    throw new Error("Remote source declares an excessive length.");
  }
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_SOURCE_BYTES) throw new Error("Remote source exceeds byte limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
  if (length && length !== received) throw new Error("Content-Length does not match source bytes.");
  return captureGutenbergBytes(bytes, request);
}

type SourceLine = { text: string; start: number; end: number; number: number };
function sourceLines(raw: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let bytePos = 0;
  const pieces = raw.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const piece of pieces) {
    if (piece.includes("\r") && !piece.endsWith("\r\n")) {
      throw new Error("Unsupported bare carriage return; preserve source for manual inspection.");
    }
    const len = Buffer.byteLength(piece, "utf8");
    lines.push({
      text: piece.replace(/\r?\n$/, ""), start: bytePos,
      end: bytePos + len, number: lines.length + 1,
    });
    bytePos += len;
  }
  return lines;
}
function span(lines: SourceLine[], begin: number, endExclusive: number): OriginalByteSpan {
  const first = lines[begin];
  const stop = endExclusive < lines.length ? lines[endExclusive].start : lines.at(-1)?.end;
  if (!first || stop === undefined || stop <= first.start) {
    throw new Error("Empty or invalid source component boundary.");
  }
  return { byte_start: first.start, byte_end: stop,
    first_line: first.number, last_line: lines[endExclusive - 1].number };
}
function findUnique(lines: SourceLine[], test: (line: string) => boolean, label: string, issues: string[]) {
  const matches = lines.flatMap((line, index) => test(line.text) ? [index] : []);
  if (matches.length !== 1) issues.push(label + ": expected one unambiguous boundary, got " + matches.length);
  return matches[0] ?? -1;
}
const startMarker = /^\*\*\* START OF (?:THIS |THE )?PROJECT GUTENBERG EBOOK\b.*\*\*\*$/i;
const endMarker = /^\*\*\* END OF (?:THIS |THE )?PROJECT GUTENBERG EBOOK\b.*\*\*\*$/i;

/**
 * Exact PG #11 edition-specific profile. Ambiguous markers or embedded rights
 * components stop composition instead of stripping them heuristically.
 */
export function extractPg11Components(snapshot: ImmutableSourceSnapshot): BoundaryResult {
  const issues: string[] = [];
  if (sha256(Buffer.from(snapshot.raw_utf8, "utf8")) !== snapshot.bytes_sha256 ||
      snapshot.bytes_length !== Buffer.byteLength(snapshot.raw_utf8, "utf8")) {
    return { status: "needs_boundary_review", review_reasons: ["Snapshot byte/hash tampering."], content_components: [] };
  }
  let lines: SourceLine[];
  try { lines = sourceLines(snapshot.raw_utf8); }
  catch (error) { return { status: "needs_boundary_review",
    review_reasons: [error instanceof Error ? error.message : "Unsupported source encoding."], content_components: [] }; }
  const start = findUnique(lines, (line) => startMarker.test(line), "PG start", issues);
  const end = findUnique(lines, (line) => endMarker.test(line), "PG end", issues);
  const firstChapter = findUnique(lines, (line) => line === "CHAPTER I. Down the Rabbit-Hole", "Content start", issues);
  const textEnd = findUnique(lines, (line) => line.trim() === "THE END", "Literary end", issues);
  const secondChapter = findUnique(lines, (line) => line === "CHAPTER II. The Pool of Tears", "Chapter II", issues);
  if (!(start >= 0 && start < firstChapter && firstChapter < secondChapter &&
        secondChapter < textEnd && textEnd < end)) {
    issues.push("Uncertain wrapper/edition/content ordering.");
  }
  const chapters = lines.filter((line) => /^CHAPTER [IVXLCDM]+\./.test(line.text));
  if (chapters.length !== 12) issues.push("Expected 12 complete chapters; manual edition audit needed.");
  const embedded = lines.filter((line, idx) => idx >= firstChapter && idx < textEnd &&
    /^\s*\[(?:Illustration|Image|Footnote|Translation|Translator)\b/i.test(line.text));
  if (embedded.length) issues.push("Embedded illustration/footnote/translation markers need component review: lines " +
    embedded.map((line) => line.number).join(", "));
  if (issues.length) return { status: "needs_boundary_review", review_reasons: issues, content_components: [] };
  const component = (id: string, kind: GutenbergComponent["kind"], label: string,
    disposition: ComponentDisposition, original: OriginalByteSpan, reason: string): GutenbergComponent =>
    ({ id, kind, label, disposition, original, reason });
  return {
    status: "ready_for_fixture",
    review_reasons: [],
    content_components: [
      component("pg11:wrapper-head", "SOURCE_WRAPPER", "Gutenberg header / legal notice",
        "exclude", span(lines, 0, start + 1), "Archived verbatim, never used as book content."),
      component("pg11:edition-front", "EDITION_CONTENT", "Edition title, author credit and Fulcrum notice",
        "exclude", span(lines, start + 1, firstChapter), "Source edition identification retained outside book blocks."),
      component("pg11:work-text", "WORK_CONTENT", "Original-language text, chapters I-XII",
        "qa_text_only", span(lines, firstChapter, textEnd), "Desk prequalification only: Carroll (d. 1898); not CZ/EU publication clearance."),
      component("pg11:edition-tail", "EDITION_CONTENT", "THE END / closing transcriber note",
        "exclude", span(lines, textEnd, end), "May contain non-literary edition material; kept in snapshot."),
      component("pg11:wrapper-license", "SOURCE_WRAPPER", "Gutenberg END marker and full license",
        "exclude", span(lines, end, lines.length), "License/trademark evidence preserved, not literary blocks."),
      { id: "pg11:cover-image", kind: "ASSET", label: "GITenberg cover.png",
        disposition: "exclude", original: null,
        reason: "No source images, cover, illustration or translation is cleared for this text-only pilot." },
    ],
  };
}
function normalizeWithOffsets(source: string, absoluteStartByte: number) {
  let normalized = "";
  const byteAtChar: number[] = [absoluteStartByte];
  let bytePos = absoluteStartByte;
  for (let index = 0; index < source.length;) {
    if (source.slice(index, index + 2) === "\r\n") {
      normalized += "\n";
      bytePos += 2; byteAtChar.push(bytePos); index += 2;
      continue;
    }
    const cp = source.codePointAt(index)!;
    const char = String.fromCodePoint(cp);
    normalized += char;
    const count = Buffer.byteLength(char, "utf8");
    if (char.length === 2) byteAtChar.push(bytePos); // do not split astral characters
    bytePos += count; byteAtChar.push(bytePos); index += char.length;
  }
  return { normalized, byteAtChar };
}
function byteLine(lines: SourceLine[], byte: number) {
  const found = lines.find((line) => byte >= line.start && byte < line.end);
  if (!found) throw new Error("Original byte anchor not in the source line table.");
  return found.number;
}

/** Bounded chapter I for facing-page UI; full source still pinned and auditable. */
export function composePg11Pilot(snapshot: ImmutableSourceSnapshot, chapterOnly = true): GutenbergPilot {
  const result = extractPg11Components(snapshot);
  if (result.status !== "ready_for_fixture") throw new Error("Source boundary review required: " + result.review_reasons.join("; "));
  const main = result.content_components.find((part) => part.id === "pg11:work-text")!;
  const lines = sourceLines(snapshot.raw_utf8);
  const firstByte = main.original!.byte_start;
  const secondLine = lines.find((line) => line.text === "CHAPTER II. The Pool of Tears")!;
  const lastByte = chapterOnly ? secondLine.start : main.original!.byte_end;
  const input = Buffer.from(snapshot.raw_utf8, "utf8").subarray(firstByte, lastByte).toString("utf8");
  const { normalized, byteAtChar } = normalizeWithOffsets(input, firstByte);
  const capture: FixtureCapture = {
    sourceId: snapshot.snapshot_ref,
    title: "Alice's Adventures in Wonderland · Chapter I",
    author: "Lewis Carroll",
    sourceLabel: "GITenberg PG #11 (2016 frozen source) · text-only QA, NOT cleared for release",
    components: [{
      id: "pg11:work-text", sourceId: snapshot.snapshot_ref, kind: "WORK_CONTENT",
      label: chapterOnly ? "Chapter I · approved for test composition only" : "Chapters I-XII · test composition only",
      raw: normalized,
      rights: { decision: "usable", jurisdiction: "fixture-only",
        reason: "Preliminary text-only desk assessment; independent CZ/EU rights gate still required." },
    }],
  };
  const artifact = composeFixtureSection(capture);
  const blocks: OriginalAnchoredBlock[] = artifact.blocks.map((entry) => {
    const item = /^CHAPTER [IVXLCDM]+\./.test(entry.block.content)
      ? { ...entry, recipe: "chapter" as const, block: { ...entry.block, type: "chapter" as const } }
      : entry;
    const a = byteAtChar[item.start], b = byteAtChar[item.end];
    if (a === undefined || b === undefined || b <= a) throw new Error("Lost exact original source byte anchor.");
    const exactSource = Buffer.from(snapshot.raw_utf8, "utf8").subarray(a, b).toString("utf8").replace(/\r\n/g, "\n");
    if (exactSource !== item.block.content) throw new Error("Original bytes do not match composed block.");
    return { ...item, original: {
      byte_start: a, byte_end: b, first_line: byteLine(lines, a),
      last_line: byteLine(lines, b - 1), snapshot_ref: snapshot.snapshot_ref,
      bytes_sha256: snapshot.bytes_sha256,
    } };
  });
  if (!artifact.qa.ok || !blocks.length) throw new Error("Source composition integrity gate failed.");
  return {
    capture, blocks, excluded: result.content_components.filter((x) => x.disposition !== "qa_text_only"),
    qa: artifact.qa, snapshot_ref: snapshot.snapshot_ref,
    source_bytes_sha256: snapshot.bytes_sha256, releaseAllowed: false,
    boundaryReview: result.review_reasons,
  };
}

export function getPg11FixtureRequest(capturedAt = "2026-10-11T00:00:00.000Z"): CaptureRequest {
  return {
    candidate_id: "fixture:pg11:candidate", candidate_source_id: "fixture:pg11:2016-edition",
    source_uri: PG11_URI, retrieval_method: "gitenberg_pinned_git_revision",
    expected_bytes_sha256: PG11_BYTES_SHA256, capture_time: capturedAt,
    jurisdiction: "CZ/EU", rights_dossier_ref: "pending:pg11-text-only-territorial-review",
  };
}

/** Output to main thread only; no database row or claimed legal decision. */
export function createPg11IntegrationPayload(snapshot: ImmutableSourceSnapshot, boundaries: BoundaryResult) {
  return {
    schema: "artales.ingest.snapshot-handoff.v1",
    candidate_id: snapshot.candidate_id,
    candidate_source_id: snapshot.candidate_source_id,
    source_uri: snapshot.source_uri,
    retrieval_method: snapshot.retrieval_method,
    bytes_sha256: snapshot.bytes_sha256,
    snapshot_ref: snapshot.snapshot_ref,
    content_components: boundaries.content_components,
    jurisdiction: snapshot.jurisdiction,
    rights_dossier_ref: snapshot.rights_dossier_ref,
    capture_time: snapshot.capture_time,
    provenance_and_license_manifest: {
      upstream_project: "Project Gutenberg #11",
      upstream_edition: "The Millennium Fulcrum Edition 3.0; archived October 2016",
      upstream_git_commit: PG11_COMMIT, upstream_git_blob_sha1: PG11_GIT_BLOB_SHA1,
      archived_licensed_source_path: "tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt",
      source_edition_url: "https://www.gutenberg.org/ebooks/11",
      author_death_year: 1898, original_language: "en",
      rights_status: "preliminary_text_only_requires_independent_CZ_EU_review",
      excluded_assets: ["GITenberg cover.png", "all illustrations", "all unreviewed translations"],
      publication_authorized: false,
    },
    release_allowed: false as const,
  };
}
