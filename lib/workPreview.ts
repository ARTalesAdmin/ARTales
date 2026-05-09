import type { WorkBlock } from "@/lib/blocks"

const DEFAULT_PREVIEW_CHAR_LIMIT = 2000
const PREVIEW_OVERFLOW_CHAR_LIMIT = 500
const MIN_USEFUL_SENTENCE_LENGTH = 280

function getBlockText(block: WorkBlock): string {
  if (block.type === "letter") {
    return String(block.fields?.body ?? block.content ?? "").trim()
  }

  return String(block.content ?? "").trim()
}

function hasReadableText(block: WorkBlock): boolean {
  if (block.type === "separator") return true
  return getBlockText(block) !== ""
}

function getLastSentenceBoundary(text: string): number {
  const sentenceBoundaryPattern = /[.!?…](?=\s|$)/g
  let match: RegExpExecArray | null
  let lastBoundary = -1

  while ((match = sentenceBoundaryPattern.exec(text)) !== null) {
    lastBoundary = match.index + match[0].length
  }

  return lastBoundary
}

function getFirstSentenceBoundaryAfter(text: string, minIndex: number): number {
  const sentenceBoundaryPattern = /[.!?…](?=\s|$)/g
  let match: RegExpExecArray | null

  while ((match = sentenceBoundaryPattern.exec(text)) !== null) {
    const boundary = match.index + match[0].length
    if (boundary >= minIndex) return boundary
  }

  return -1
}

function trimToWordBoundary(text: string): string {
  const trimmed = text.trim()
  const lastWhitespaceIndex = trimmed.search(/\s+\S*$/)

  if (lastWhitespaceIndex > MIN_USEFUL_SENTENCE_LENGTH) {
    return trimmed.slice(0, lastWhitespaceIndex).trim()
  }

  return trimmed
}

export function truncateTextForPreview(
  text: string,
  preferredCharLimit = DEFAULT_PREVIEW_CHAR_LIMIT
): string {
  const normalized = text.replace(/\r\n/g, "\n").trim()

  if (normalized.length <= preferredCharLimit) return normalized

  const hardLimit = Math.min(
    normalized.length,
    preferredCharLimit + PREVIEW_OVERFLOW_CHAR_LIMIT
  )
  const candidate = normalized.slice(0, hardLimit)
  const lastBoundaryBeforeLimit = getLastSentenceBoundary(
    candidate.slice(0, preferredCharLimit)
  )

  if (lastBoundaryBeforeLimit >= MIN_USEFUL_SENTENCE_LENGTH) {
    return candidate.slice(0, lastBoundaryBeforeLimit).trim()
  }

  const firstBoundaryAfterLimit = getFirstSentenceBoundaryAfter(
    candidate,
    preferredCharLimit
  )

  if (firstBoundaryAfterLimit >= MIN_USEFUL_SENTENCE_LENGTH) {
    return candidate.slice(0, firstBoundaryAfterLimit).trim()
  }

  return `${trimToWordBoundary(normalized.slice(0, preferredCharLimit))}…`
}

function cloneBlockWithText(block: WorkBlock, nextText: string): WorkBlock {
  if (block.type === "letter") {
    return {
      ...block,
      content: nextText,
      fields: {
        ...(block.fields ?? {}),
        body: nextText,
      },
    }
  }

  return {
    ...block,
    content: nextText,
  }
}

export function getPreviewBlocks(
  blocks: WorkBlock[],
  preferredCharLimit = DEFAULT_PREVIEW_CHAR_LIMIT
): WorkBlock[] {
  const visibleBlocks = blocks.filter(hasReadableText)
  const previewBlocks: WorkBlock[] = []
  let usedCharacters = 0

  for (const block of visibleBlocks) {
    if (block.type === "separator") {
      if (previewBlocks.length > 0) previewBlocks.push(block)
      continue
    }

    const text = getBlockText(block)
    const separatorLength = usedCharacters > 0 ? 2 : 0
    const nextTotal = usedCharacters + separatorLength + text.length

    if (nextTotal <= preferredCharLimit) {
      previewBlocks.push(block)
      usedCharacters = nextTotal
      continue
    }

    const remainingCharacters = Math.max(
      MIN_USEFUL_SENTENCE_LENGTH,
      preferredCharLimit - usedCharacters - separatorLength
    )
    const truncatedText = truncateTextForPreview(text, remainingCharacters)

    if (truncatedText) {
      previewBlocks.push(cloneBlockWithText(block, truncatedText))
    }

    break
  }

  return previewBlocks
}

export function getPreviewFallbackContent(
  fallbackContent: string | null | undefined,
  preferredCharLimit = DEFAULT_PREVIEW_CHAR_LIMIT
): string | null {
  if (!fallbackContent?.trim()) return null
  return truncateTextForPreview(fallbackContent, preferredCharLimit)
}
