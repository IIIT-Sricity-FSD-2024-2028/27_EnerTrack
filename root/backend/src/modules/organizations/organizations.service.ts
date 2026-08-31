import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  DatabaseService,
  MeterStatus,
  MeterType,
  OrganizationStatus,
  UserRole,
} from "../../core/database/database.service";

/** Grid emissions factor for Indian electricity, kg CO2 per kWh. */
const GRID_CO2_KG_PER_KWH = 0.82;
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { PutOrganizationDto } from "./dto/put-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateOrganizationDto) {
    const exists = this.database.organizations.find(
      (x) => x.name.toLowerCase() === createDto.name.toLowerCase(),
    );
    if (exists)
      throw new ConflictException(
        `An organization named '${createDto.name}' already exists`,
      );

    const generatedId = crypto.randomUUID();
    const newRecord = { organization_id: generatedId, ...createDto };
    this.database.organizations.push(newRecord as any);
    return newRecord;
  }

  /**
   * An organisation signing itself up. This is where the engagement starts.
   *
   * Public, because the person doing it has no account yet — the same
   * reasoning as POST /users/register. It creates the organisation as a
   * PROSPECT and its first user as an Organization Admin, together, because
   * either one alone is a dead record: an organisation with nobody in it
   * cannot request an audit, and a user with no organisation belongs to no
   * tenant and would see nothing.
   *
   * That first user being an Organization Admin is deliberate, and it is the
   * one case where self-appointing as account owner is correct. Joining an
   * *existing* organisation in that role is still refused by
   * UsersService.register via SELF_REGISTERABLE_ROLES — you may own the
   * organisation you just created, never one that already exists.
   *
   * Honest limitation: this is an unauthenticated write, so it is spammable.
   * What limits the damage is that the record does nothing on its own — a
   * prospect has no subscription, no data and no dashboards worth the name
   * until an auditor engages with it — and duplicate names are refused
   * outright.
   */
  registerSelfServe(dto: RegisterOrganizationDto) {
    const nameTaken = this.database.organizations.find(
      (o) => o.name.toLowerCase() === dto.name.trim().toLowerCase(),
    );
    if (nameTaken)
      throw new ConflictException(
        `An organisation named '${dto.name}' is already registered. If this is yours, ask its administrator to invite you.`,
      );

    const email = dto.admin_email.trim().toLowerCase();
    const emailTaken = this.database.users.find(
      (u) => u.email.toLowerCase() === email,
    );
    if (emailTaken)
      throw new ConflictException(
        `An account already exists for ${dto.admin_email}`,
      );

    const organization = {
      organization_id: crypto.randomUUID(),
      name: dto.name.trim(),
      type: dto.type.trim(),
      location: dto.location?.trim() || null,
      status: OrganizationStatus.PROSPECT,
      floor_area_sqm: dto.floor_area_sqm ?? null,
      tariff_rate: null,
      contract_start: null,
    };
    this.database.organizations.push(organization as any);

    const admin = {
      user_id: crypto.randomUUID(),
      organization_id: organization.organization_id,
      name: dto.admin_name.trim(),
      email,
      phone: dto.admin_phone?.trim() || null,
      password: dto.admin_password,
      role: UserRole.ORGANIZATION_ADMIN,
      specialization: null,
    };
    this.database.users.push(admin as any);

    // Same shape as login, so the sign-up page can drop the caller straight
    // into a session rather than making them type their password again.
    const { password: _pw, ...safeAdmin } = admin;
    return { organization, admin: safeAdmin };
  }

  /**
   * Id and name of every organisation, for the public sign-up selector.
   *
   * Deliberately NOT scoped to the tenant: the caller has no account and so no
   * tenant yet. That is safe only because the projection is minimal — a name a
   * visitor could read off a website anyway. Never widen this shape.
   */
  listPublic() {
    return this.database.organizations.map((o) => ({
      organization_id: o.organization_id,
      name: o.name,
    }));
  }

  findAll() {
    // On this entity organization_id IS the tenant key, so scoping it here
    // means a client sees only its own record. EnerTrack staff send no
    // x-org-id and still get the full client list.
    return scopeToTenant(this.database.organizations);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.organizations.find(
      (item) => item.organization_id === id,
    ));
    if (!record)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutOrganizationDto) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.organizations[index]))
      throw new NotFoundException(`Organization with ID ${id} not found`);
    this.database.organizations[index] = {
      organization_id: id,
      ...putDto,
    } as any;
    return this.database.organizations[index];
  }

  update(id: string, updateDto: UpdateOrganizationDto) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.organizations[index]))
      throw new NotFoundException(`Organization with ID ${id} not found`);
    this.database.organizations[index] = {
      ...this.database.organizations[index],
      ...updateDto,
      organization_id: this.database.organizations[index].organization_id,
    };
    return this.database.organizations[index];
  }

  remove(id: string) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.organizations[index]))
      throw new NotFoundException(`Organization with ID ${id} not found`);

    const campusCount = this.database.campus.filter(
      (c) => c.organization_id === id,
    ).length;
    if (campusCount > 0)
      throw new ConflictException(
        `Cannot delete organization ${id}: it still owns ${campusCount} campus record(s)`,
      );

    const removed = this.database.organizations.splice(index, 1);
    return removed[0];
  }

  /** Campuses belonging to this organization. */
  getCampuses(id: string) {
    return scopeToTenant(this.database.campus.filter((c) => c.organization_id === id));
  }

  /**
   * What an organisation has saved, by comparing a period against the same
   * calendar month a year earlier.
   *
   * This is the whole savings story, and it is deliberately this simple.
   * Comparing July against July cancels seasonality for free — a campus in
   * coastal Andhra uses far more in May than in December, and the only way
   * to compare fairly without a weather model is to compare like months.
   *
   * Note what this does NOT do: it does not feed an invoice. EnerTrack
   * charges a subscription, not a share of savings, so this figure only
   * ever has to be *useful* rather than *litigable*. That is why it can be
   * sixty lines instead of six hundred — rigour is proportional to
   * consequence.
   *
   * Accepts either a single `period`, or a `from`/`to` range that rolls
   * several months up, which is what the ROI panels use.
   */
  savings(id: string, opts: { period?: string; from?: string; to?: string }) {
    const org = assertTenantOwns(
      this.database.organizations.find((o) => o.organization_id === id),
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${id} not found`);

    const periods = this.resolvePeriods(opts);
    const meterIds = this.database.meters
      .filter(
        (m) =>
          m.organization_id === id &&
          m.meter_type === MeterType.ELECTRICITY &&
          // A decommissioned meter stops reporting, so leaving it in would
          // show its silence as a saving.
          m.status !== MeterStatus.DECOMMISSIONED,
      )
      .map((m) => m.meter_id);

    const tariff = org.tariff_rate ?? 0;
    const months = periods.map((period) => {
      const now = this.kwhIn(meterIds, period);
      const before = this.kwhIn(meterIds, this.oneYearEarlier(period));
      return { period, kwh: now, kwh_year_ago: before, saved_kwh: before - now };
    });

    const kwh = months.reduce((sum, m) => sum + m.kwh, 0);
    const kwhYearAgo = months.reduce((sum, m) => sum + m.kwh_year_ago, 0);
    const savedKwh = kwhYearAgo - kwh;

    return {
      organization_id: id,
      organization_name: org.name,
      from: periods[0],
      to: periods[periods.length - 1],
      months_compared: periods.length,
      meter_ids: meterIds,
      kwh,
      kwh_year_ago: kwhYearAgo,
      saved_kwh: savedKwh,
      saved_amount: Math.round(savedKwh * tariff),
      saved_co2_kg: Math.round(savedKwh * GRID_CO2_KG_PER_KWH),
      change_pct:
        kwhYearAgo > 0
          ? Number(((-savedKwh / kwhYearAgo) * 100).toFixed(1))
          : 0,
      // A client with no comparison data yet is not a client with no
      // savings, and the two must not read the same on a dashboard.
      has_comparison: kwhYearAgo > 0,
      months,
    };
  }

  /** Total kWh recorded on a set of meters during one "YYYY-MM". */
  private kwhIn(meterIds: string[], period: string): number {
    if (meterIds.length === 0) return 0;
    return Math.round(
      this.database.meterReadings
        .filter(
          (r) =>
            meterIds.includes(r.meter_id) &&
            typeof r.timestamp === "string" &&
            r.timestamp.slice(0, 7) === period,
        )
        .reduce((sum, r) => sum + Number(r.value || 0), 0),
    );
  }

  private oneYearEarlier(period: string): string {
    const [year, month] = period.split("-");
    return `${Number(year) - 1}-${month}`;
  }

  /** Normalises the period/from/to arguments into a list of "YYYY-MM". */
  private resolvePeriods(opts: { period?: string; from?: string; to?: string }) {
    const valid = (p?: string) => !!p && /^\d{4}-\d{2}$/.test(p);

    if (valid(opts.period)) return [opts.period as string];
    if (!valid(opts.from) || !valid(opts.to))
      throw new BadRequestException(
        "Supply either period=YYYY-MM, or from=YYYY-MM&to=YYYY-MM",
      );

    const periods: string[] = [];
    let [year, month] = (opts.from as string).split("-").map(Number);
    const [endYear, endMonth] = (opts.to as string).split("-").map(Number);
    if (year > endYear || (year === endYear && month > endMonth))
      throw new BadRequestException(
        `'from' (${opts.from}) must not be after 'to' (${opts.to})`,
      );

    while (year < endYear || (year === endYear && month <= endMonth)) {
      periods.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return periods;
  }

  /** User accounts belonging to this organization. */
  getUsers(id: string) {
    // Same rule as UsersService: a password never leaves the API. This route
    // reaches the user list through the organization rather than through
    // /users, so it needs its own strip.
    return scopeToTenant(
      this.database.users.filter((u) => u.organization_id === id),
    ).map(({ password: _pw, ...safe }) => safe);
  }
}
