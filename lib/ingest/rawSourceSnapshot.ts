import { createHash } from "node:crypto";
import type { SnapshotFileChoice } from "./lockedSnapshotSelection";

/** S1: source-only binary capture. A real caller must re-read a locked, approved
 * Legal decision and resolve the catalog on the SERVER. This never grants rights,
 * writes to production Storage, or creates a semantic/published revision. */
export type RawSourcePart = Readonly<{
  path: string;
  kind: "literary_text_candidate" | "embedded_image" | "package_metadata" | "stylesheet" | "other";
  compressed_bytes: number;
  expanded_bytes: number;
  crc32: number | null;
  publication_clearance: "not_evaluated" | "excluded";
}>;
export type RawSourceManifest = Readonly<{
  schema: "artales.raw-source-snapshot.v1";
  selection: SnapshotFileChoice;
  snapshot_ref: string;
  sha256: string;
  bytes: number;
  captured_at: string;
  original_filename: string;
  archive_path: string;
  parts: readonly RawSourcePart[];
  embedded_images: number;
  archive_scope: "text_only_package" | "assets_require_review";
  archive_ready: boolean;
  status: "captured_not_persisted";
  semantic_contract: "artales.semantic-text.v2";
  semantic_ready: false;
  publication_authorized: false;
}>;
export type RawSourceCapture = Readonly<{ manifest: RawSourceManifest; original: Uint8Array }>;
const LIMIT = 8 * 1024 * 1024;
const MAX_ENTRIES = 400;
const MAX_EXPANDED = 48 * 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const iso = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Rechecks an S0 choice before any outbound connection. No redirects to third-party hosts. */
export function assertTrustedSnapshotChoice(choice: SnapshotFileChoice): number {
  if (!choice || choice.schema !== "artales.snapshot-selection.v1" ||
      choice.source_archive_status !== "not_captured" || choice.semantic_ready !== false ||
      choice.publication_authorized !== false || !Number.isSafeInteger(choice.decision_no) ||
      choice.decision_no < 1 || !["epub", "html", "plain_text"].includes(choice.format) ||
      !["locked", "same_record_alternative"].includes(choice.selection) ||
      !["locked_file", "pending_content_comparison"].includes(choice.correspondence)) {
    throw new Error("untrusted_snapshot_choice");
  }
  const catalog = new URL(choice.catalog_url);
  const hit = /^\/ebooks\/([1-9][0-9]{0,7})\/?$/.exec(catalog.pathname);
  if (!hit || catalog.protocol !== "https:" || catalog.hostname !== "www.gutenberg.org" ||
      catalog.port || catalog.username || catalog.password || catalog.search || catalog.hash) {
    throw new Error("untrusted_snapshot_catalog");
  }
  const id = Number(hit[1]);
  for (const value of [choice.original_locked_url, choice.chosen_url]) {
    const u = new URL(value);
    if (u.protocol !== "https:" || !["www.gutenberg.org", "gutenberg.org", "m.gutenberg.org"].includes(u.hostname) ||
        u.port || u.username || u.password || u.search || u.hash || /%|\\/.test(u.pathname) ||
        !(u.pathname.startsWith("/ebooks/" + id + ".") ||
          u.pathname.startsWith("/cache/epub/" + id + "/") ||
          u.pathname.startsWith("/files/" + id + "/"))) {
      throw new Error("untrusted_snapshot_download_url");
    }
  }
  if ((choice.selection === "locked") !== (choice.chosen_url === choice.original_locked_url) ||
      (choice.correspondence === "locked_file") !== (choice.selection === "locked")) {
    throw new Error("untrusted_format_substitution");
  }
  return id;
}
function zipParts(bytes: Uint8Array): RawSourcePart[] {
  const b = Buffer.from(bytes);
  if (b.length < 66 || b.readUInt32LE(0) !== 0x04034b50) throw new Error("not_epub_zip");
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("epub_directory_missing");
  const count = b.readUInt16LE(eocd + 10), otherCount = b.readUInt16LE(eocd + 8);
  const size = b.readUInt32LE(eocd + 12), start = b.readUInt32LE(eocd + 16);
  if (b.readUInt16LE(eocd + 4) || b.readUInt16LE(eocd + 6) || count !== otherCount ||
      count < 2 || count > MAX_ENTRIES || size === 0xffffffff || start === 0xffffffff ||
      start + size !== eocd) throw new Error("unsafe_epub_directory");
  let pos = start, expanded = 0;
  const seen = new Set<string>(), ranges: Array<[number, number]> = [], parts: RawSourcePart[] = [];
  let hasMime = false, hasContent = false;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > eocd || b.readUInt32LE(pos) !== 0x02014b50) throw new Error("epub_central_header_invalid");
    const flags = b.readUInt16LE(pos + 8), method = b.readUInt16LE(pos + 10);
    const packed = b.readUInt32LE(pos + 20), plain = b.readUInt32LE(pos + 24);
    const nameLength = b.readUInt16LE(pos + 28), extra = b.readUInt16LE(pos + 30);
    const comment = b.readUInt16LE(pos + 32), offset = b.readUInt32LE(pos + 42);
    const next = pos + 46 + nameLength + extra + comment;
    if (next > eocd || !nameLength || ![0, 8].includes(method) ||
        (flags & 0x0041) || packed === 0xffffffff || plain === 0xffffffff ||
        offset === 0xffffffff || packed > LIMIT || plain > MAX_EXPANDED ||
        expanded + plain > MAX_EXPANDED || offset + 30 > start ||
        b.readUInt32LE(offset) !== 0x04034b50 ||
        b.readUInt16LE(offset + 6) !== flags || b.readUInt16LE(offset + 8) !== method ||
        (method === 0 && packed !== plain)) throw new Error("unsafe_epub_entry");
    let name: string, localName: string;
    try {
      name = utf8.decode(b.subarray(pos + 46, pos + 46 + nameLength));
      const localNameLength = b.readUInt16LE(offset + 26);
      localName = utf8.decode(b.subarray(offset + 30, offset + 30 + localNameLength));
    } catch { throw new Error("invalid_epub_filename_encoding"); }
    if (!name || name !== localName || name.startsWith("/") || name.includes("\\") ||
        name.includes("%") || /[\x00-\x1f]/.test(name) ||
        name.split("/").some(part => part === "." || part === "..") || seen.has(name)) {
      throw new Error("unsafe_epub_filename");
    }
    seen.add(name);
    const begin = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28);
    const end = begin + packed;
    if (end > start || begin > end) throw new Error("epub_entry_outside_data");
    if (packed) ranges.push([begin, end]);
    if (name === "mimetype") {
      hasMime = true;
      if (i !== 0 || method !== 0 || packed !== 20 ||
          b.subarray(begin, end).toString("ascii") !== "application/epub+zip") {
        throw new Error("epub_mimetype_invalid");
      }
    }
    const kind: RawSourcePart["kind"] = /\.(?:xhtml|html|htm)$/i.test(name) ? "literary_text_candidate" :
      /\.(?:png|jpe?g|gif|svg|webp)$/i.test(name) ? "embedded_image" :
      /\.(?:opf|ncx|xml)$/i.test(name) || name === "mimetype" ? "package_metadata" :
      /\.css$/i.test(name) ? "stylesheet" : "other";
    if (kind === "literary_text_candidate") hasContent = true;
    parts.push({ path: name, kind, compressed_bytes: packed, expanded_bytes: plain,
      crc32: b.readUInt32LE(pos + 16), publication_clearance: kind === "embedded_image" ? "excluded" : "not_evaluated" });
    expanded += plain;
    pos = next;
  }
  if (pos !== eocd || !hasMime || !hasContent) throw new Error("incomplete_epub_inventory");
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] < ranges[i - 1][1]) throw new Error("overlapping_epub_entries");
  }
  return parts;
}
function plainPart(bytes: Uint8Array, format: "html" | "plain_text"): RawSourcePart[] {
  let s: string;
  try { s = utf8.decode(bytes); } catch { throw new Error("source_text_encoding_requires_review"); }
  if (s.length < 30 || s.includes("\0") ||
      (format === "html" && !/<!doctype\s+html\b|<html\b/i.test(s.slice(0, 1200)))) {
    throw new Error("unrecognized_source_text");
  }
  return [{ path: format === "html" ? "source.html" : "source.txt", kind: "literary_text_candidate",
    compressed_bytes: bytes.length, expanded_bytes: bytes.length, crc32: null, publication_clearance: "not_evaluated" }];
}
/** Capture does not imply trusted editor approval of embedded images.
 * A full EPUB containing images can be archived only after a separate authorized
 * private-retention decision; this pure S1 capture always leaves it gated. */
export function captureRawSource(selection: SnapshotFileChoice, input: Uint8Array, capturedAt: string): RawSourceCapture {
  const id = assertTrustedSnapshotChoice(selection);
  if (!iso(capturedAt) || input.length < 30 || input.length > LIMIT) throw new Error("invalid_capture_size_or_time");
  const original = Uint8Array.from(input);
  const parts = selection.format === "epub" ? zipParts(original) : plainPart(original, selection.format);
  const count = parts.filter(p => p.kind === "embedded_image").length;
  const digest = hash(original);
  const suffix = selection.format === "plain_text" ? "txt" : selection.format;
  return { original, manifest: {
    schema: "artales.raw-source-snapshot.v1", selection,
    snapshot_ref: "sha256:" + digest, sha256: digest, bytes: original.length,
    captured_at: capturedAt, original_filename: "original." + suffix,
    archive_path: "gutenberg/" + id + "/sha256/" + digest + "/original." + suffix,
    parts, embedded_images: count,
    archive_scope: count ? "assets_require_review" : "text_only_package",
    archive_ready: count === 0,
    status: "captured_not_persisted", semantic_contract: "artales.semantic-text.v2",
    semantic_ready: false, publication_authorized: false,
  } };
}
/** A server integration must respect Gutenberg's supported acquisition channel.
 * No automatic retry/redirect, endpoint, credential or persistent job exists. */
export async function fetchRawSource(choice: SnapshotFileChoice, fetchedAt: string,
  fetcher: typeof fetch = fetch): Promise<RawSourceCapture> {
  assertTrustedSnapshotChoice(choice);
  const res = await fetcher(choice.chosen_url, {
    method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { Accept: choice.format === "epub" ? "application/epub+zip,application/octet-stream;q=0.7" :
      choice.format === "html" ? "text/html" : "text/plain" },
  });
  if (res.status !== 200 || res.redirected || !res.body ||
      (res.url && res.url !== choice.chosen_url)) throw new Error("snapshot_source_http_refused");
  const declaredRaw = res.headers.get("content-length");
  const declared = declaredRaw === null ? null : Number(declaredRaw);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 0 || declared > LIMIT)) {
    throw new Error("source_declared_size_invalid");
  }
  const chunks: Uint8Array[] = [];
  const reader = res.body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMIT) throw new Error("snapshot_stream_exceeds_limit");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (declared !== null && declared !== total) throw new Error("snapshot_stream_size_mismatch");
  return captureRawSource(choice, Buffer.concat(chunks, total), fetchedAt);
}