import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  /** Tenant the caller is acting within, from the x-org-id header. */
  orgId: string | null;
  /** Caller's role, from the x-role header. */
  role: string | null;
  /** True when the caller is EnerTrack staff rather than a client user. */
  isPlatformSide: boolean;
}

/**
 * Per-request tenant context.
 *
 * Held in AsyncLocalStorage so services can scope their data without every
 * controller and service signature having to thread an organisation id
 * through by hand. Populated by TenantMiddleware.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/**
 * Narrows a collection to the caller's tenant.
 *
 * Returns the collection untouched when no x-org-id header was sent, which
 * keeps every existing frontend page and API consumer working exactly as
 * before. Send the header to opt into tenant scoping.
 *
 * Records with a null organization_id (EnerTrack's own staff accounts) are
 * excluded from a tenant-scoped result, so a client never sees them.
 */
export function scopeToTenant<T extends { organization_id?: string | null }>(
  records: T[],
): T[] {
  const ctx = getTenantContext();
  if (!ctx || !ctx.orgId) return records;
  return records.filter((r) => r.organization_id === ctx.orgId);
}

/**
 * Guards a single record. Returns null when it belongs to another tenant,
 * so callers can raise their own NotFoundException rather than leaking the
 * fact that the id exists at all.
 */
export function assertTenantOwns<T extends { organization_id?: string | null }>(
  record: T | undefined,
): T | undefined {
  if (!record) return undefined;
  const ctx = getTenantContext();
  if (!ctx || !ctx.orgId) return record;
  return record.organization_id === ctx.orgId ? record : undefined;
}

/** Organisation the current request is acting within, if any. */
export function currentOrgId(): string | null {
  return getTenantContext()?.orgId ?? null;
}
