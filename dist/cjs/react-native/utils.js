"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLatest = void 0;
const react_1 = require("react");
const useLatest = (value) => {
    const ref = (0, react_1.useRef)(value);
    (0, react_1.useEffect)(() => {
        ref.current = value;
    }, [value]);
    return ref;
};
exports.useLatest = useLatest;
//# sourceMappingURL=utils.js.map