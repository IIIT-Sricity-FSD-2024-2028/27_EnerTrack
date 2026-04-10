const defaultData = {
    session: {},
    workflow: {
        serviceRequests: [],
        wastageReports: [],
        categories: []
    }
};

class UniversalDB {
    constructor() {
        this.data = this._load();
    }
    _load() {
        const stored = {
            session: {},
            workflow: {
                wastageReports: [{ id: "WR-1" }, { id: "WR-2" }]
            }
        };
        return this._deepMerge(JSON.parse(JSON.stringify(defaultData)), stored);
    }
    _deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
                Object.assign(source[key], this._deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }
}
const db = new UniversalDB();
console.log(JSON.stringify(db.data.workflow.wastageReports));
