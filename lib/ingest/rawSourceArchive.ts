import { createHash } from "node:crypto";
import type { RawSourceCapture } from "./rawSourceSnapshot";
/** Private Storage bucket exists as infrastructure (2026-10-26), but no writer/route
 * is deployed or authorized by its creation. Server-only permission and a real
 * byte-for-byte archive/readback integration require independent approval. */
export const RAW_SNAPSHOT_BUCKET = "artales-raw-snapshots";
export type RawSnapshotStorageClient = Readonly<{ storage: { from(bucket: string): {
  upload(path: string, bytes: Uint8Array, options: { contentType: string; upsert: false; cacheControl: string }): Promise<{error: unknown}>;
  download(path: string): Promise<{data: {arrayBuffer(): Promise<ArrayBuffer>} | null; error: unknown}>;
} } }>;
export type VerifiedRawArchiveReceipt = Readonly<{
  schema: "artales.raw-source-archive-receipt.v1";
  snapshot_ref: string;
  bucket: typeof RAW_SNAPSHOT_BUCKET;
  path: string;
  sha256: string;
  bytes: number;
  storage_readback: "sha256_verified";
  private_image_retention: "admin_confirmed_archive_only" | "none";
  embedded_images: number;
  image_publication_clearance: "excluded";
  semantic_ready: false;
  publication_authorized: false;
}>;
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
/** Write-once, verified binary readback. No public bucket, upsert or client keys.
 * Requires a separately approved server-only auth/grant and Storage setup. */
export async function archiveRawSource(capture: RawSourceCapture, client: RawSnapshotStorageClient, bucket: string, options?: Readonly<{ privateImageRetentionApproved: true }>): Promise<VerifiedRawArchiveReceipt> {
  const m = capture.manifest;
  if (bucket !== RAW_SNAPSHOT_BUCKET ||
      !((m.archive_ready && m.archive_scope === "text_only_package" && m.embedded_images === 0) ||
        (options?.privateImageRetentionApproved === true &&
         m.archive_scope === "assets_require_review" && m.embedded_images > 0 && !m.archive_ready &&
         m.parts.filter(p=>p.kind==="embedded_image").length === m.embedded_images &&
         m.parts.every(p=>p.kind!=="embedded_image" || p.publication_clearance==="excluded"))) ||
      m.status !== "captured_not_persisted" || m.semantic_ready !== false ||
      m.publication_authorized !== false || capture.original.length !== m.bytes ||
      hash(capture.original) !== m.sha256 || m.snapshot_ref !== "sha256:" + m.sha256 ||
      m.archive_path !== "gutenberg/" + /\/(\d+)$/.exec(m.selection.catalog_url)?.[1] + "/sha256/" + m.sha256 + "/" + m.original_filename) {
    throw new Error("raw_source_archive_gate_refused");
  }
  const contentType = m.selection.format === "epub" ? "application/epub+zip" :
    m.selection.format === "html" ? "text/html" : "text/plain";
  const store = client.storage.from(bucket);
  const inserted = await store.upload(m.archive_path, capture.original, {contentType, upsert: false, cacheControl: "0"});
  if (inserted.error) throw new Error("raw_source_upload_failed");
  const fetched = await store.download(m.archive_path);
  if (fetched.error || !fetched.data) throw new Error("raw_source_readback_failed");
  const actual = new Uint8Array(await fetched.data.arrayBuffer());
  if (actual.length !== m.bytes || hash(actual) !== m.sha256) throw new Error("raw_source_readback_digest_mismatch");
  return {schema: "artales.raw-source-archive-receipt.v1", snapshot_ref: m.snapshot_ref,
    bucket: RAW_SNAPSHOT_BUCKET, path: m.archive_path, sha256: m.sha256, bytes: actual.length,
    storage_readback: "sha256_verified",
    private_image_retention: m.embedded_images ? "admin_confirmed_archive_only" : "none",
    embedded_images: m.embedded_images, image_publication_clearance: "excluded",
    semantic_ready: false, publication_authorized: false};
}