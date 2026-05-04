"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitiativesService = void 0;
var common_1 = require("@nestjs/common");
var InitiativesService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var InitiativesService = _classThis = /** @class */ (function () {
        function InitiativesService_1(database) {
            this.database = database;
        }
        InitiativesService_1.prototype.create = function (createDto) {
            var id = Date.now().toString() + Math.random().toString(36).substring(7);
            var newRecord = __assign({ initiative_id: id }, createDto);
            this.database.initiatives.push(newRecord);
            return newRecord;
        };
        InitiativesService_1.prototype.findAll = function () {
            return this.database.initiatives;
        };
        InitiativesService_1.prototype.findOne = function (id) {
            var record = this.database.initiatives.find(function (item) { return item.initiative_id === id; });
            if (!record)
                throw new common_1.NotFoundException("Initiative with ID ".concat(id, " not found"));
            return record;
        };
        InitiativesService_1.prototype.update = function (id, updateDto) {
            var index = this.database.initiatives.findIndex(function (item) { return item.initiative_id === id; });
            if (index === -1)
                throw new common_1.NotFoundException("Initiative with ID ".concat(id, " not found"));
            this.database.initiatives[index] = __assign(__assign({}, this.database.initiatives[index]), updateDto);
            return this.database.initiatives[index];
        };
        InitiativesService_1.prototype.remove = function (id) {
            var index = this.database.initiatives.findIndex(function (item) { return item.initiative_id === id; });
            if (index === -1)
                throw new common_1.NotFoundException("Initiative with ID ".concat(id, " not found"));
            var removed = this.database.initiatives.splice(index, 1);
            return removed[0];
        };
        return InitiativesService_1;
    }());
    __setFunctionName(_classThis, "InitiativesService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InitiativesService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InitiativesService = _classThis;
}();
exports.InitiativesService = InitiativesService;
