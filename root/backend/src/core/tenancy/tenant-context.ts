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
  // No context at all means the middleware never ran, which happens when a
  // service is called directly from a unit test. Left untouched deliberately.
  if (!ctx) return records;

  // Acting inside a tenant: that tenant's records only.
  if (ctx.orgId) return records.filter((r) => r.organization_id === ctx.orgId);

  // No tenant. Only EnerTrack's own staff get the cross-tenant view, and that
  // is decided by their role, never by the mere absence of an x-org-id header.
  if (ctx.isPlatformSide) return records;

  // Anyone else with no tenant belongs nowhere, so they see nothing. This
  // fails closed on purpose: a self-registered account arrives with a null
  // organization_id, and the old "no org means show everything" rule handed
  // it the whole platform.
  return [];
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
  if (!ctx) return record;
  if (ctx.orgId)
    return record.organization_id === ctx.orgId ? record : undefined;
  if (ctx.isPlatformSide) return record;
  return undefined;
}

/** Organisation the current request is acting within, if any. */
export function currentOrgId(): string | null {
  return getTenantContext()?.orgId ?? null;
}
