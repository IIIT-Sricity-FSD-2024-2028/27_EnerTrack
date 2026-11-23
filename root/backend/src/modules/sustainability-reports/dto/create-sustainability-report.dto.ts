import { GenerateSustainabilityReportDto } from "./generate-sustainability-report.dto";

/**
 * What a client may send to save a report: the period (and optionally an
 * explicit from/to range and a title). Everything else — totals, deltas,
 * metrics, data gaps, meter coverage, who generated it and when — is
 * computed or stamped by the server, so a saved report always matches the
 * meter readings it claims to summarise. Extra fields (metrics,
 * generated_by_id, ...) are rejected by the global whitelist pipe.
 */
export class CreateSustainabilityReportDto extends GenerateSustainabilityReportDto {}
