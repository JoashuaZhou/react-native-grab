import { useEffect, useRef } from "react";
export const useLatest = (value) => {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref;
};
//# sourceMappingURL=utils.js.map