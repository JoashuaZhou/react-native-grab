"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewHost = exports.configureReview = void 0;
let reviewHost = null;
const configureReview = (host) => {
    reviewHost = host;
};
exports.configureReview = configureReview;
const getReviewHost = () => reviewHost;
exports.getReviewHost = getReviewHost;
//# sourceMappingURL=host.js.map