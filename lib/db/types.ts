import type {
  InvestigationCase,
  Alert,
  EvidenceRecord,
  Chain,
  RiskBand,
  CaseStatus,
} from "@/lib/types"
import type { InvestigationResult } from "@/lib/engines"

// Two persistence strategies are exposed by the repository layer:
//   IN_MEMORY  - DevelopmentDatabase, backed by the singleton in-memory store.
//                Data does NOT survive a server restart.
//   POSTGRES   - ProductionDatabase, backed by PostgreSQL via DATABASE_URL.
//                Data survives refresh, navigation and server restart.
export type PersistenceMode = "IN_MEMORY" | "POSTGRES"

// The minimum event types recorded on the investigation audit/history log.
// This is an append-only audit trail, NOT event sourcing.
export const INVESTIGATION_EVENT_TYPES = [
  "CASE_CREATED",
  "INVESTIGATION_SAVED",
  "INVESTIGATION_UPDATED",
  "INVESTIGATION_RUN",
  "RISK_ASSESSMENT_GENERATED",
  "ALERT_GENERATED",
  "EVIDENCE_ADDED",
  "REPORT_GENERATED",
] as const

export type InvestigationEventType = (typeof INVESTIGATION_EVENT_TYPES)[number]

// A complete, persistable snapshot of an investigation and its related data.
// Complex existing objects (the full case + multi-engine result) are stored as
// JSON so persistence never requires refactoring the blockchain/engine logic.
export interface InvestigationRecord {
  id: string
  userId: string | null
  case: InvestigationCase
  investigation: InvestigationResult | null
  alerts: Alert[]
  evidence: EvidenceRecord[]
  createdAt: string
  updatedAt: string
}

// Lightweight projection used by the case list.
export interface InvestigationListItem {
  id: string
  title: string
  reportedWallet: string
  chain: Chain
  complaintRef: string
  riskScore: number
  riskBand: RiskBand
  status: CaseStatus
  investigator: string
  createdAt: string
  updatedAt: string
}

export interface InvestigationEventRecord {
  id: string
  investigationId: string
  actor: string | null
  action: string
  detail: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface SaveInvestigationInput {
  case: InvestigationCase
  investigation?: InvestigationResult | null
  alerts?: Alert[]
  evidence?: EvidenceRecord[]
  userId?: string | null
  actor?: string | null
}

export interface SearchQuery {
  q?: string
  status?: string
  limit?: number
}

// Minimum operations every persistence backend implements.
export interface DatabaseRepository {
  readonly persistenceMode: PersistenceMode
  // Idempotent. IN_MEMORY: no-op. POSTGRES: verifies connectivity and ensures
  // the schema exists. Throws on a real connection/persistence failure (never
  // silently falls back to memory).
  init(): Promise<void>
  saveInvestigation(input: SaveInvestigationInput): Promise<InvestigationRecord>
  updateInvestigation(id: string, patch: Partial<SaveInvestigationInput>): Promise<InvestigationRecord>
  getInvestigation(id: string): Promise<InvestigationRecord | null>
  listInvestigations(): Promise<InvestigationListItem[]>
  searchInvestigations(query: SearchQuery): Promise<InvestigationListItem[]>
  getInvestigationHistory(id: string): Promise<InvestigationEventRecord[]>
  appendInvestigationEvent(
    event: Omit<InvestigationEventRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ): Promise<InvestigationEventRecord>
}

// Derive the case-list projection from a full case object.
export function toListItem(c: InvestigationCase): InvestigationListItem {
  return {
    id: c.id,
    title: c.title,
    reportedWallet: c.reportedWallet,
    chain: c.chain,
    complaintRef: c.complaintRef,
    riskScore: c.riskScore,
    riskBand: c.riskBand,
    status: c.status,
    investigator: c.investigator,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function matchesQuery(c: InvestigationCase, q: string): boolean {
  const term = q.trim().toLowerCase()
  if (!term) return true
  return `${c.id} ${c.title} ${c.reportedWallet} ${c.complaintRef} ${c.status}`
    .toLowerCase()
    .includes(term)
}
