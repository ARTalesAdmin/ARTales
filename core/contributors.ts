import { Contributor } from "./types"

export const contributors: Contributor[] = [
  {
    id: "contrib-dracula-author",
    workId: "work-dracula",
    entityName: "Bram Stoker",
    entityType: "person",
    roleType: "author",
    creditLabel: "Author",
  },
  {
    id: "contrib-pride-author",
    workId: "work-pride-and-prejudice",
    entityName: "Jane Austen",
    entityType: "person",
    roleType: "author",
    creditLabel: "Author",
  },
  {
    id: "contrib-sherlock-author",
    workId: "work-sherlock-holmes",
    entityName: "Arthur Conan Doyle",
    entityType: "person",
    roleType: "author",
    creditLabel: "Author",
  },
  {
  id: "contrib-dracula-cz-author",
  workId: "work-dracula-cz-translation",
  entityName: "ARTales",
  entityType: "organization",
  roleType: "author",
  creditLabel: "Organizational Author",
},
{
  id: "contrib-dracula-cz-ai",
  workId: "work-dracula-cz-translation",
  entityName: "AI Translation Module",
  entityType: "ai",
  roleType: "ai_assist",
  creditLabel: "AI Assist",
},
{
  id: "contrib-dracula-cz-review",
  workId: "work-dracula-cz-translation",
  entityName: "ARTales Editorial Review",
  entityType: "organization",
  roleType: "editor",
  creditLabel: "Editorial Review",
}
]