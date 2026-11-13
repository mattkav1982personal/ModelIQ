(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const assessmentEngine = (studio.assessmentEngine = {});

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  assessmentEngine.run = function run(projectData, semanticModel, reportAnalysis, daxAnalysis) {
    const tables = semanticModel?.tables || [];
    const measures = semanticModel?.measures || [];
    const relationships = semanticModel?.relationships || [];
    const reportPages = reportAnalysis?.pages || [];
    const daxResults = daxAnalysis?.results || [];
    const semanticModelAvailable = projectData?.metadata?.semanticModelAvailable !== false;

    const modelingScore = clamp(100 - (relationships.filter((relationship) => relationship.cardinality?.toLowerCase().includes('many')).length * 5) - (tables.filter((table) => (table.columns || []).length > 20).length * 6));
    const daxScore = clamp(daxAnalysis?.averageScore || 80);
    const governanceScore = clamp(100 - (tables.reduce((count, table) => count + (table.description ? 0 : 3), 0)) - (measures.filter((measure) => !measure.description).length * 4));
    const uxScore = clamp(100 - Math.max(0, reportPages.length * 4) - Math.max(0, (reportAnalysis?.totalVisuals || 0) * 0.5));
    const performanceScore = clamp(100 - (relationships.length * 5) - (tables.filter((table) => (table.columns || []).length > 25).length * 8));
    const documentationScore = clamp(88 - (tables.filter((table) => !table.description).length * 6));

    const overall = Math.round(
      (
        modelingScore * 0.22 +
        daxScore * 0.2 +
        governanceScore * 0.15 +
        uxScore * 0.15 +
        performanceScore * 0.18 +
        documentationScore * 0.1
      )
    );

    const risks = semanticModelAvailable ? [
      'Review relationship cardinality and filter direction to avoid ambiguous model behaviour.',
      'Audit measures with high complexity and repeated filter logic.',
      'Improve documentation coverage for tables and measures with missing descriptions.',
      'Validate report page density and accessibility for consistent UX delivery.',
    ] : [
      'PBIX semantic model metadata is unavailable; load the PBIP/TMDL source for model, DAX, governance and performance assessment.',
      'Validate report page density and accessibility for consistent UX delivery.',
    ];

    const recommendations = semanticModelAvailable ? [
      'Document missing table and measure descriptions to strengthen governance.',
      'Simplify complex DAX patterns and centralize reusable calculations.',
      'Reduce relationship complexity and review cross-filter direction.',
      'Improve page-level usability and accessibility checks before sign-off.',
    ] : [
      'Use the PBIP project or TMDL files for semantic model, DAX, relationship and governance assessment.',
      'Review the detected report pages and visual inventory for layout and accessibility improvements.',
    ];

    return {
      scores: {
        overall: semanticModelAvailable ? overall : null,
        modeling: semanticModelAvailable ? modelingScore : null,
        dax: semanticModelAvailable ? daxScore : null,
        governance: semanticModelAvailable ? governanceScore : null,
        ux: uxScore,
        performance: semanticModelAvailable ? performanceScore : null,
        documentation: semanticModelAvailable ? documentationScore : null,
      },
      risks,
      recommendations,
      daxResults,
    };
  };
})();
