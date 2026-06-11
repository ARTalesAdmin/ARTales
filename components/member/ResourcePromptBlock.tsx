"use client";

import { useState } from "react";

type ResourcePromptBlockProps = {
  label: string;
  prompt: string;
};

export function ResourcePromptBlock({ label, prompt }: ResourcePromptBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="artales-resource-prompt-block">
      <div className="artales-resource-prompt-block__header">
        <span>{label}</span>
        <button type="button" className="artales-button-secondary" onClick={copyPrompt}>
          {copied ? "Zkopírováno" : "Kopírovat prompt"}
        </button>
      </div>
      <pre className="artales-resource-prompt"><code>{prompt}</code></pre>
    </div>
  );
}
