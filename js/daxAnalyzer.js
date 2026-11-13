(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const daxAnalyzer = (studio.daxAnalyzer = {});

  function getExpressionDetails(expression) {
    const normalized = (expression || '').trim();
    const checks = [
      { name: 'Hard coded values', regex: /\b\d+(?:\.\d+)?\b|['"][^'"]+['"]/g, severity: 'warning' },
      { name: 'Nested iterators', regex: /SUMX|AVERAGEX|COUNTX|MINX|MAXX/g, severity: 'warning' },
      { name: 'FILTER usage', regex: /FILTER\s*\(/gi, severity: 'warning' },
      { name: 'CALCULATE nesting', regex: /CALCULATE\s*\(/gi, severity: 'warning' },
      { name: 'Context transition', regex: /EARLIER|EARLIEST|RELATEDTABLE|SELECTEDVALUE/gi, severity: 'warning' },
      { name: 'Deprecated pattern', regex: /IF\s*\(\s*ISBLANK|SUM\s*\(/gi, severity: 'info' },
    ];

    return checks
      .map((check) => ({ ...check, matches: normalized.match(check.regex) || [] }))
      .filter((check) => check.matches.length > 0);
  }

  daxAnalyzer.analyze = function analyze(measures) {
    const results = measures.map((measure) => {
      const details = getExpressionDetails(measure.expression);
      const complexity = measure.complexity || 'Simple';
      const severityScore = details.length * 18 + (complexity === 'Very Complex' ? 22 : complexity === 'Complex' ? 14 : complexity === 'Moderate' ? 8 : 0);
      const daxScore = Math.max(25, 100 - severityScore);

      return {
        name: measure.name,
        table: measure.table,
        expression: measure.expression,
        complexity,
        details,
        daxScore,
        recommendations: details.length
          ? [
              'Review iterative logic for filter and row context performance.',
              'Reduce repeated calculations where possible and centralize reusable logic.',
              'Test measure behaviour with edge-case filters and blank scenarios.',
            ]
          : ['Measure follows a clean pattern with limited complexity.'],
      };
    });

    return {
      results,
      averageScore: results.length ? Math.round(results.reduce((total, item) => total + item.daxScore, 0) / results.length) : 100,
    };
  };
})();
