(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const aiGenerator = (studio.aiGenerator = {});

  aiGenerator.generate = function generate(projectData, analysis) {
    const model = analysis?.model || projectData.model;
    const tables = model.tables || [];
    const measures = model.measures || [];
    const risks = analysis?.risks || [];

    const contextText = [
      `Project: ${projectData.projectName}`,
      '',
      'Business glossary:',
      `- This solution contains ${tables.length} tables and ${measures.length} measures.`,
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
        qualityScore: analysis?.scores?.overall || 0,
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
