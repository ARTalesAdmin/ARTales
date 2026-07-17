import { sanitizeWorkBlocks, type WorkBlock } from "@/lib/blocks"

export type WorkContentInsertRun = {
  insertAfterBlockId: string | null
  blocks: WorkBlock[]
}

export type WorkContentChangeSet = {
  deletedBlockIds: string[]
  updatedBlocks: WorkBlock[]
  insertRuns: WorkContentInsertRun[]
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  )
}

function normalizeInsertRuns(value: unknown): WorkContentInsertRun[] {
  if (!Array.isArray(value)) return []

  return value
    .map((run) => {
      if (!run || typeof run !== "object") return null

      const rawRun = run as {
        insertAfterBlockId?: unknown
        insert_after_block_id?: unknown
        blocks?: unknown
      }
      const insertAfterValue = rawRun.insertAfterBlockId ?? rawRun.insert_after_block_id
      const insertAfterBlockId =
        typeof insertAfterValue === "string" && insertAfterValue.trim() !== ""
          ? insertAfterValue.trim()
          : null
      const blocks = sanitizeWorkBlocks(Array.isArray(rawRun.blocks) ? rawRun.blocks : [])

      if (blocks.length === 0) return null

      return { insertAfterBlockId, blocks }
    })
    .filter((run): run is WorkContentInsertRun => Boolean(run))
}

export function sanitizeWorkContentChangeSet(value: unknown): WorkContentChangeSet {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    deletedBlockIds: normalizeStringArray(
      payload.deletedBlockIds ?? payload.deleted_block_ids,
    ),
    updatedBlocks: sanitizeWorkBlocks(
      Array.isArray(payload.updatedBlocks)
        ? payload.updatedBlocks
        : Array.isArray(payload.updated_blocks)
          ? payload.updated_blocks
          : [],
    ),
    insertRuns: normalizeInsertRuns(payload.insertRuns ?? payload.insert_runs),
  }
}

export function hasWorkContentChanges(changeSet: WorkContentChangeSet) {
  return (
    changeSet.deletedBlockIds.length > 0 ||
    changeSet.updatedBlocks.length > 0 ||
    changeSet.insertRuns.some((run) => run.blocks.length > 0)
  )
}

export function countInsertedBlocks(changeSet: WorkContentChangeSet) {
  return changeSet.insertRuns.reduce((total, run) => total + run.blocks.length, 0)
}

export function applyWorkContentChangeSet(
  baseBlocks: WorkBlock[],
  changeSet: WorkContentChangeSet,
) {
  let merged = [...baseBlocks]
  const deletedIds = new Set(changeSet.deletedBlockIds)

  if (deletedIds.size > 0) {
    merged = merged.filter((block) => !deletedIds.has(block.id))
  }

  if (changeSet.updatedBlocks.length > 0) {
    const updatedById = new Map(
      changeSet.updatedBlocks
        .filter((block) => !deletedIds.has(block.id))
        .map((block) => [block.id, block] as const),
    )

    if (updatedById.size > 0) {
      merged = merged.map((block) => updatedById.get(block.id) ?? block)
    }
  }

  const seenIds = new Set(merged.map((block) => block.id))

  changeSet.insertRuns.forEach((run) => {
    const blocksToInsert = run.blocks.filter((block) => {
      if (deletedIds.has(block.id)) return false
      if (seenIds.has(block.id)) return false
      seenIds.add(block.id)
      return true
    })

    if (blocksToInsert.length === 0) return

    if (!run.insertAfterBlockId) {
      merged = [...blocksToInsert, ...merged]
      return
    }

    const anchorIndex = merged.findIndex((block) => block.id === run.insertAfterBlockId)

    if (anchorIndex < 0) {
      merged = [...merged, ...blocksToInsert]
      return
    }

    const next = [...merged]
    next.splice(anchorIndex + 1, 0, ...blocksToInsert)
    merged = next
  })

  return merged
}
