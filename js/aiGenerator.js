(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const aiGenerator = (studio.aiGenerator = {});

  aiGenerator.generate = function generate(projectData, analysis) {
    const model = analysis?.model || projectData.model;
    const tables = model.tables || [];
    const measures = model.measures || [];
    const risks = analysis?.risks || [];
    const semanticModelAvailable = projectData.metadata?.semanticModelAvailable !== false;

    const contextText = [
      `Project: ${projectData.projectName}`,
      `Input format: ${projectData.metadata?.format || 'PBIP'}`,
      '',
      'Business glossary:',
      semanticModelAvailable
        ? `- This solution contains ${tables.length} tables and ${measures.length} measures.`
        : '- Semantic model tables and measures are not available in this PBIX report-only analysis.',
      `- Primary modeling themes include ${tables.slice(0, 3).map((table) => table.name).join(', ')}.`,
      '',
      'Key calculations:',
      ...measures.slice(0, 4).map((measure) => `- ${measure.name}: ${measure.expression || 'No expression available'}`),
      '',
      'Risks:',
      ...risks.map((risk) => `- ${risk}`),
      '',
      'Recommended next steps:',
      '- Improve documentation coverage.',
      '- Simplify complex DAX logic.',
      '- Validate star schema and relationship isolation.',
    ].join('\n');

    const knowledgeJson = {
      solution: {
        name: projectData.projectName,
        format: projectData.metadata?.format || 'PBIP',
        semanticModelAvailable,
        qualityScore: analysis?.scores?.overall ?? null,
      },
      tables: tables.map((table) => ({
        name: table.name,
        description: table.description || '',
        columns: (table.columns || []).length,
      })),
      measures: measures.map((measure) => ({
        name: measure.name,
        table: measure.table,
        description: measure.description || '',
        expression: measure.expression || '',
      })),
      relationships: (projectData.model.relationships || []).map((relationship) => ({
        from: relationship.from,
        to: relationship.to,
        cardinality: relationship.cardinality || 'Many-to-one',
      })),
      businessDefinitions: [],
      risks,
    };

    return {
      contextText,
      knowledgeJson,
    };
  };
})();
