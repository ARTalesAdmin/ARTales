export type WorkType =
  | "original"
  | "translation"
  | "remix"
  | "adaptation"
  | "edition"

export type WorkStatus =
  | "reading"
  | "editing"
  | "open"
  | "edition"
  | "published"
  | "archived"

export type VersionType =
  | "draft"
  | "review"
  | "published"
  | "archived"

export type ContributorEntityType =
  | "person"
  | "collective"
  | "organization"
  | "ai"
  | "unknown"

export type ContributorRoleType =
  | "author"
  | "editor"
  | "translator"
  | "publisher"
  | "typographer"
  | "community"
  | "ai_assist"

export type SourceType =
  | "original_submission"
  | "gutenberg"
  | "archive"
  | "scan"
  | "internal_project"
  | "community_input"

export type LegalStatus =
  | "public_domain"
  | "copyrighted"
  | "licensed"
  | "unclear"

export type RelationType =
  | "translation_of"
  | "remix_of"
  | "adaptation_of"
  | "continuation_of"
  | "edition_of"

export type Work = {
  id: string
  title: string
  slug: string
  summary: string
  workType: WorkType
  canonicalLanguage: string
  status: WorkStatus
  createdAt: string
  updatedAt: string
}

export type Version = {
  id: string
  workId: string
  versionNumber: number
  content: string
  versionType: VersionType
  isCurrent: boolean
  createdAt: string
}

export type Contributor = {
  id: string
  workId?: string
  versionId?: string
  entityName: string
  entityType: ContributorEntityType
  roleType: ContributorRoleType
  creditLabel: string
}

export type Source = {
  id: string
  workId?: string
  versionId?: string
  sourceType: SourceType
  sourceLabel: string
  sourceReference?: string
}

export type Rights = {
  id: string
  workId: string
  legalStatus: LegalStatus
  rightsHolder: string
  licenseType: string
  notes?: string
}

export type WorkRelation = {
  id: string
  parentWorkId: string
  childWorkId: string
  relationType: RelationType
}