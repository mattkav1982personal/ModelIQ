(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const documentationGenerator = (studio.documentationGenerator = {});

  documentationGenerator.generate = function generate(projectData, analysis) {
    const model = analysis?.model || projectData.model;
    const tables = model.tables || [];
    const measures = model.measures || [];
    const risks = analysis?.risks || [];

    return {
      executiveSummary: {
        projectName: projectData.projectName,
        tableCount: tables.length,
        measureCount: measures.length,
        overallQuality: analysis?.scores?.overall || 0,
        summary: `The ${projectData.projectName} solution contains ${tables.length} tables and ${measures.length} measures. The current assessment shows a strong baseline with opportunities in documentation, DAX maintainability and relationship quality.`,
      },
      technicalInventory: {
        tables: tables.map((table) => ({
          name: table.name,
          description: table.description || 'No description available',
          columns: (table.columns || []).length,
        })),
        measures: measures.map((measure) => ({
          name: measure.name,
          table: measure.table,
          complexity: measure.complexity || 'Simple',
        })),
      },
      topRisks: risks,
      recommendations: analysis?.recommendations || [],
      markdown: `# ${projectData.projectName}\n\n## Executive Summary\n${projectData.projectName} is a Power BI semantic model with ${tables.length} tables and ${measures.length} measures.\n\n## Architecture Highlights\n- Primary tables: ${tables.slice(0, 5).map((table) => table.name).join(', ')}\n- Quality score: ${analysis?.scores?.overall || 0}/100\n\n## Risks\n${risks.map((risk) => `- ${risk}`).join('\n')}\n\n## Recommendations\n${(analysis?.recommendations || []).map((item) => `- ${item}`).join('\n')}`,
    };
  };
})();
