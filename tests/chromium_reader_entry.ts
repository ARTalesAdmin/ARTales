// Browser-facing test entrypoint: production engine, not a copied algorithm.
export {iterateSemanticPages, verifySemanticPageCoverage, shouldJustifySemanticPageEnd, fittingSemanticPageRows, assessSemanticPageBreak} from "../lib/semantic/readerProjection";
export {segmentSemanticProse} from "../lib/semantic/protectedSpans";
export {measureSemanticDomLastRow,measureSemanticDomRows,syncSemanticMeasurementPaperWidth,applySemanticProseLastRowJustification} from "../lib/semantic/domLineGeometry";

// Reuse the production legacy paper pass in the browser geometry regression.
export {applyLegacyPaperLastRowJustification} from "../lib/reader/legacyLastRow";
