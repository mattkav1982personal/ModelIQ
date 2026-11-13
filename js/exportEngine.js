(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const exportEngine = (studio.exportEngine = {});

  function scoreLabel(value) {
    return value == null ? 'Not available' : `${value}/100`;
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  exportEngine.exportTxt = function exportTxt(projectData, analysis) {
    const text = [
      `Project: ${projectData.projectName}`,
      '',
      `Overall quality score: ${analysis?.scores?.overall == null ? 'Not available for report-only PBIX analysis' : `${analysis.scores.overall}/100`}`,
      '',
      'Top risks:',
      ...(analysis?.risks || []).map((risk) => `- ${risk}`),
      '',
      'Recommendations:',
      ...(analysis?.recommendations || []).map((item) => `- ${item}`),
    ].join('\n');
    downloadBlob(`${projectData.projectName.replace(/\s+/g, '-')}.txt`, text, 'text/plain;charset=utf-8');
  };

  exportEngine.exportJson = function exportJson(projectData, analysis) {
    const payload = {
      project: projectData.projectName,
      format: projectData.metadata?.format || 'PBIP',
      analysisNotes: projectData.metadata?.analysisNotes || [],
      scores: analysis?.scores || {},
      risks: analysis?.risks || [],
      recommendations: analysis?.recommendations || [],
      tables: projectData.model.tables || [],
      measures: projectData.model.measures || [],
      relationships: projectData.model.relationships || [],
    };
    downloadBlob(`${projectData.projectName.replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  exportEngine.exportCsv = function exportCsv(projectData) {
    const tableRows = [(projectData.model.tables || []).map((table) => `"${table.name}","${(table.columns || []).length}","${table.dataSource || ''}"`).join('\n')];
    const csv = `Table,Columns,DataSource\n${tableRows}`;
    downloadBlob(`${projectData.projectName.replace(/\s+/g, '-')}-inventory.csv`, csv, 'text/csv;charset=utf-8');
  };

  exportEngine.exportExecutivePdf = function exportExecutivePdf(projectData, analysis) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('The PDF library is not available in this browser environment.');
      return;
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFillColor(11, 18, 32);
    pdf.rect(0, 0, 595, 842, 'F');
    pdf.setTextColor(237, 245, 255);
    pdf.setFontSize(22);
    pdf.text(projectData.projectName, 40, 60);
    pdf.setFontSize(12);
    pdf.text(`Overall Quality Score: ${scoreLabel(analysis?.scores?.overall)}`, 40, 90);
    pdf.text(`Modeling: ${scoreLabel(analysis?.scores?.modeling)}`, 40, 110);
    pdf.text(`DAX: ${scoreLabel(analysis?.scores?.dax)}`, 40, 130);
    pdf.text(`Governance: ${scoreLabel(analysis?.scores?.governance)}`, 40, 150);

    pdf.setFontSize(14);
    pdf.text('Key risks', 40, 190);
    pdf.setFontSize(11);
    (analysis?.risks || []).slice(0, 4).forEach((risk, index) => {
      pdf.text(`${index + 1}. ${risk}`, 50, 215 + index * 18);
    });

    pdf.setFontSize(14);
    pdf.text('Recommendations', 40, 300);
    pdf.setFontSize(11);
    (analysis?.recommendations || []).slice(0, 4).forEach((item, index) => {
      pdf.text(`${index + 1}. ${item}`, 50, 325 + index * 18);
    });

    pdf.save(`${projectData.projectName.replace(/\s+/g, '-')}-executive.pdf`);
  };

  exportEngine.exportTechnicalPdf = function exportTechnicalPdf(projectData, analysis) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('The PDF library is not available in this browser environment.');
      return;
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFillColor(16, 28, 40);
    pdf.rect(0, 0, 595, 842, 'F');
    pdf.setTextColor(237, 245, 255);
    pdf.setFontSize(18);
    pdf.text(`${projectData.projectName} - Technical Documentation`, 40, 60);
    pdf.setFontSize(11);

    let offsetY = 95;
    const tables = projectData.model.tables || [];
    if (projectData.metadata?.semanticModelAvailable === false) {
      pdf.text('PBIX report layout parsed. Semantic model inventory is not available in this browser-only build.', 40, offsetY);
      offsetY += 22;
      (projectData.report.pages || []).forEach((page) => {
        pdf.text(`${page.displayName || page.name}: ${page.visualCount || 0} visuals`, 40, offsetY);
        offsetY += 16;
      });
    }

    tables.slice(0, 12).forEach((table) => {
      pdf.text(`${table.name}: ${table.description || 'No description'}`, 40, offsetY);
      offsetY += 18;
    });

    offsetY += 24;
    pdf.text('Measures', 40, offsetY);
    offsetY += 18;
    (projectData.model.measures || []).slice(0, 10).forEach((measure) => {
      pdf.text(`${measure.name} (${measure.table})`, 50, offsetY);
      offsetY += 16;
    });

    pdf.save(`${projectData.projectName.replace(/\s+/g, '-')}-technical.pdf`);
  };
})();
