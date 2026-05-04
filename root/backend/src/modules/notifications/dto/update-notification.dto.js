"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateNotificationDto = void 0;
var mapped_types_1 = require("@nestjs/mapped-types");
var create_notification_dto_1 = require("./create-notification.dto");
var UpdateNotificationDto = /** @class */ (function (_super) {
    __extends(UpdateNotificationDto, _super);
    function UpdateNotificationDto() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return UpdateNotificationDto;
}((0, mapped_types_1.PartialType)(create_notification_dto_1.CreateNotificationDto)));
exports.UpdateNotificationDto = UpdateNotificationDto;
