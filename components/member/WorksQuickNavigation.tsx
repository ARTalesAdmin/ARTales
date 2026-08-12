"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import type { MemberWorkSearchResult, WorkStatus } from "@/lib/dbWorks"

type Copy = {
  label: string
  placeholder: string
  helper: string
  loading: string
  noResults: string
  error: string
  resultsLabel: string
  updated: string
  statuses: Record<WorkStatus, string>
}

export function WorksQuickNavigation({ copy }: { copy: Copy }) {
  const listboxId = useId()
  const requestNumber = useRef(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MemberWorkSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setResults([])
      setLoading(false)
      setFailed(false)
      setOpen(false)
      return
    }

    const currentRequest = ++requestNumber.current
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      setOpen(true)
      try {
        const response = await fetch(`/member/works/search?q=${encodeURIComponent(normalized)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Search failed")
        const payload = (await response.json()) as { results: MemberWorkSearchResult[] }
        if (requestNumber.current === currentRequest) {
          setResults(payload.results)
          setActiveIndex(payload.results.length ? 0 : -1)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        if (requestNumber.current === currentRequest) setFailed(true)
      } finally {
        if (requestNumber.current === currentRequest) setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function openActiveResult() {
    const result = results[activeIndex]
    if (result) window.location.assign(`/member/works/${result.slug}/edit`)
  }

  return (
    <section style={{ maxWidth: "720px", marginTop: "24px", position: "relative" }}>
      <label htmlFor={`${listboxId}-input`} style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>
        {copy.label}
      </label>
      <input
        id={`${listboxId}-input`}
        type="search"
        value={query}
        placeholder={copy.placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-describedby={`${listboxId}-helper`}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => Math.min(index + 1, results.length - 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === "Enter" && open && activeIndex >= 0) {
            event.preventDefault()
            openActiveResult()
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
        style={{ width: "100%", padding: "12px 14px", border: "1px solid #777", borderRadius: "8px", font: "inherit" }}
      />
      <p id={`${listboxId}-helper`} style={{ margin: "6px 0 0", fontSize: "14px", opacity: 0.75 }}>
        {copy.helper}
      </p>

      {open ? (
        <div id={listboxId} role="listbox" aria-label={copy.resultsLabel} style={{ position: "absolute", zIndex: 10, top: "76px", width: "100%", border: "1px solid rgba(13, 21, 40, 0.2)", borderRadius: "10px", background: "#fffdf8", boxShadow: "0 12px 30px rgba(13, 21, 40, 0.12)", overflow: "hidden" }}>
          <p role="status" aria-live="polite" style={{ margin: 0 }}>
            {loading ? <span style={{ display: "block", padding: "12px 14px" }}>{copy.loading}</span> : null}
            {!loading && failed ? <span style={{ display: "block", padding: "12px 14px" }}>{copy.error}</span> : null}
            {!loading && !failed && results.length === 0 ? <span style={{ display: "block", padding: "12px 14px" }}>{copy.noResults}</span> : null}
          </p>
          {!loading && !failed ? results.map((work, index) => (
            <Link
              key={work.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              href={`/member/works/${work.slug}/edit`}
              onMouseEnter={() => setActiveIndex(index)}
              style={{ display: "block", padding: "12px 14px", color: "#111", textDecoration: "none", borderTop: index ? "1px solid rgba(13, 21, 40, 0.1)" : undefined, background: activeIndex === index ? "rgba(13, 21, 40, 0.07)" : undefined }}
            >
              <strong>{work.title_cs ?? work.title_en ?? work.title}</strong>
              <span style={{ display: "block", fontSize: "14px", opacity: 0.78 }}>
                {[work.author?.name_cs ?? work.author?.name_en ?? work.author?.name, copy.statuses[work.status], `/${work.slug}`].filter(Boolean).join(" · ")}
              </span>
              {work.updated_at ? <span style={{ display: "block", fontSize: "13px", opacity: 0.65 }}>{copy.updated} {new Intl.DateTimeFormat("cs-CZ").format(new Date(work.updated_at))}</span> : null}
            </Link>
          )) : null}
        </div>
      ) : null}
    </section>
  )
}
