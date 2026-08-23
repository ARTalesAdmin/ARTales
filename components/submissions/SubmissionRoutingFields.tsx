"use client";

import { useState } from "react";
import type { SubmissionRecipient, SubmissionWorkOption } from "@/lib/dbSubmissionOptions";

type Props = { works: SubmissionWorkOption[]; recipients: SubmissionRecipient[] };

export default function SubmissionRoutingFields({ works, recipients }: Props) {
  const [recipientId, setRecipientId] = useState("");

  return (
    <>
      <label>
        <strong>Dílo</strong>
        <select
          name="work_id"
          defaultValue=""
          onChange={(event) => {
            const work = works.find((item) => item.id === event.target.value);
            const suggestedId = work?.responsible_editor_id ?? "";
            setRecipientId(
              recipients.some((recipient) => recipient.id === suggestedId) ? suggestedId : "",
            );
          }}
          style={{ display: "block", width: "100%", marginTop: 8, padding: "12px 14px" }}
        >
          <option value="">Bez konkrétního díla</option>
          {works.map((work) => (
            <option key={work.id} value={work.id}>
              {work.title}{work.author_name ? ` — ${work.author_name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        <strong>Příjemce</strong>
        <select
          name="target_editor_user_id"
          value={recipientId}
          onChange={(event) => setRecipientId(event.target.value)}
          style={{ display: "block", width: "100%", marginTop: 8, padding: "12px 14px" }}
        >
          <option value="">Kterýkoli editor</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.display_name}{recipient.handle ? ` (@${recipient.handle})` : ""}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
