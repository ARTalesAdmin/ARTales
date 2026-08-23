import { createClient } from "@/lib/supabase/server";

export type SubmissionRecipient = {
  id: string;
  display_name: string;
  handle: string | null;
};

export type SubmissionWorkOption = {
  id: string;
  title: string;
  responsible_editor_id: string | null;
  author_name: string | null;
};

export async function listSubmissionRecipients(): Promise<SubmissionRecipient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_submission_recipient_options");
  if (error) throw new Error(`Failed to load submission recipients: ${error.message}`);
  return (data ?? []) as SubmissionRecipient[];
}

export async function listSubmissionWorkOptions(): Promise<SubmissionWorkOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select("id, title, responsible_editor_id, authors:primary_author_id(name)")
    .order("title", { ascending: true });
  if (error) throw new Error(`Failed to load submission works: ${error.message}`);

  return (data ?? []).map((row) => {
    const author = Array.isArray(row.authors) ? row.authors[0] : row.authors;
    return {
      id: String(row.id),
      title: String(row.title),
      responsible_editor_id: row.responsible_editor_id == null ? null : String(row.responsible_editor_id),
      author_name: author?.name == null ? null : String(author.name),
    };
  });
}
