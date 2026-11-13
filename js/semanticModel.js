(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const semanticModel = (studio.semanticModel = {});

  function getTableColumns(table) {
    return Array.isArray(table.columns) ? table.columns : [];
  }

  function determineComplexity(measure, expression) {
    if (!expression) return 'Simple';
    const score = expression.length + (expression.match(/CALCULATE/gi) || []).length * 25 + (expression.match(/FILTER\s*\(/gi) || []).length * 20 + (expression.match(/VAR\s+/gi) || []).length * 12 + (expression.match(/SUMX|AVERAGEX|COUNTX|MAXX|MINX/gi) || []).length * 25;

    if (score > 260) return 'Very Complex';
    if (score > 150) return 'Complex';
    if (score > 70) return 'Moderate';
    return 'Simple';
  }

  semanticModel.analyze = function analyze(projectData) {
    const tables = Array.isArray(projectData?.model?.tables) ? projectData.model.tables : [];
    const measures = Array.isArray(projectData?.model?.measures) ? projectData.model.measures : [];
    const relationships = Array.isArray(projectData?.model?.relationships) ? projectData.model.relationships : [];

    const columnCount = tables.reduce((count, table) => count + getTableColumns(table).length, 0);
    const hiddenColumns = tables.reduce((count, table) => count + getTableColumns(table).filter((column) => column.hidden).length, 0);

    const enrichedMeasures = measures.map((measure, index) => {
      const expression = measure.expression || '';
      const complexity = determineComplexity(measure, expression);
      const notes = [];

      if ((expression.match(/CALCULATE/gi) || []).length > 1) {
        notes.push('Multiple CALCULATE statements may reduce readability and increase evaluation cost.');
      }
      if ((expression.match(/FILTER\s*\(/gi) || []).length > 0) {
        notes.push('Filter patterns should be reviewed for performance and context transition risk.');
      }
      if ((expression.match(/SUMX|AVERAGEX|COUNTX|MAXX|MINX/gi) || []).length > 0) {
        notes.push('Iterator usage should be checked for row-by-row evaluation cost.');
      }
      if ((expression.match(/VAR\s+/gi) || []).length > 0) {
        notes.push('Variable usage is good for readability; consider keeping expression modular.');
      }
      if (!notes.length) {
        notes.push('This measure is relatively straightforward and easy to maintain.');
      }

      return {
        ...measure,
        id: index + 1,
        complexity,
        notes,
      };
    });

    return {
      tables,
      measures: enrichedMeasures,
      relationships,
      summary: {
        tableCount: tables.length,
        measureCount: enrichedMeasures.length,
        calculatedColumnCount: tables.reduce((count, table) => count + getTableColumns(table).filter((column) => column.isKey || column.name.toLowerCase().includes('calc')).length, 0),
        relationshipCount: relationships.length,
        columnCount,
        hiddenColumns,
        visualCount: Array.isArray(projectData?.report?.pages) ? projectData.report.pages.reduce((count, page) => count + (page.visualCount || 0), 0) : 0,
        reportPageCount: Array.isArray(projectData?.report?.pages) ? projectData.report.pages.length : 0,
        dataSources: projectData?.model?.dataSources || [],
      },
    };
  };
})();
