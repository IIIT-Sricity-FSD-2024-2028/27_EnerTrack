/**
 * meterReadingsSlice.js: /meter-readings (id: reading_id). Owner: Person 1.
 * CRUD from createCrudSlice (see its header).
 */
import { createCrudSlice } from "../createCrudSlice";

const meterReadings = createCrudSlice({
  name: "meterReadings",
  path: "/meter-readings",
  idKey: "reading_id",
});

export const {
  fetchAll: fetchMeterReadings,
  fetchOne: fetchMeterReading,
  create: createMeterReading,
  update: updateMeterReading,
  remove: removeMeterReading,
} = meterReadings.thunks;

export const {
  selectAll: selectAllMeterReadings,
  selectById: selectMeterReadingById,
  selectStatus: selectMeterReadingsStatus,
  selectError: selectMeterReadingsError,
} = meterReadings.selectors;

export default meterReadings.reducer;
