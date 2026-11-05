/**
 * Rendered by the owner that currently resolves selection, so the controls live in
 * the same native window as the content they act on. A natively presented surface
 * gets its own window, and no z-index inside the main window can paint over it -
 * on iOS `FullScreenOverlay` lifts the bar above every window, but Android has no
 * equivalent, which left the bar stranded behind presented sheets.
 *
 * The bar is placed against the measured size of its container rather than the
 * window's, since that container is a sheet rather than the whole screen whenever
 * a surface owns selection.
 */
export declare const GrabOwnerControls: () => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=grab-controls.d.ts.map