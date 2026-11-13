(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const app = (studio.app = {});

  const state = {
    project: null,
    activeTab: 'overview-panel',
  };

  function setLoading(isLoading, message = 'Processing project...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (!overlay) return;
    loadingText.textContent = message;
    overlay.classList.toggle('hidden', !isLoading);
  }

  function setProjectStatus(message, tone = 'muted') {
    const badge = document.getElementById('project-status');
    badge.textContent = message;
    badge.className = `status-badge ${tone}`.trim();
  }

  function setProjectTitle(text) {
    const title = document.getElementById('project-title');
    if (title) title.textContent = text;
  }

  function updateNav(targetId) {
    document.querySelectorAll('.nav-link').forEach((button) => {
      button.classList.toggle('active', button.dataset.target === targetId);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === targetId);
    });
    state.activeTab = targetId;
  }

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function renderGaugeChart(canvasId, value, color = '#2ab7ff') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const chart = new Chart(context, {
      type: 'doughnut',
      data: {
        labels: ['Score', 'Remaining'],
        datasets: [{
          data: [value, 100 - value],
          backgroundColor: [color, 'rgba(255,255,255,0.08)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
    });

    return chart;
  }

  function renderOverview(project) {
    const container = document.getElementById('overview-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No project loaded yet.</div>';
      return;
    }

    const summary = project.analysis.model.summary;
    const scores = project.analysis.assessment.scores;
    const cards = [
      { label: 'Total tables', value: summary.tableCount },
      { label: 'Total measures', value: summary.measureCount },
      { label: 'Calculated columns', value: summary.calculatedColumnCount },
      { label: 'Relationships', value: summary.relationshipCount },
      { label: 'Report pages', value: summary.reportPageCount },
      { label: 'Visual count', value: summary.visualCount },
    ];

    const gaugeEntries = [
      { label: 'Complexity', value: clamp(Math.round((summary.measureCount + summary.relationshipCount) / 2 + 20)), color: '#2ab7ff' },
      { label: 'Technical Debt', value: clamp(100 - scores.modeling + 10), color: '#ffcc66' },
      { label: 'Quality', value: scores.overall, color: '#38d39f' },
    ];

    container.innerHTML = `
      <div class="kpi-grid">
        ${cards.map((card) => `
          <div class="kpi-card">
            <div class="kpi-label">${card.label}</div>
            <div class="kpi-value">${card.value}</div>
          </div>
        `).join('')}
      </div>

      <div class="gauge-grid">
        ${gaugeEntries.map((entry) => `
          <div class="score-card">
            <div class="score-meta">
              <div class="score-title">${entry.label}</div>
              <div class="score-value">${entry.value}</div>
            </div>
            <div class="chart-wrap" style="height: 160px;">
              <canvas id="gauge-${entry.label.toLowerCase().replace(/\s+/g, '-')}"></canvas>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="panel-card">
        <div class="panel-title">Assessment highlights</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Score</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Modelling</td><td>${scores.modeling}</td><td><span class="badge success">Strong</span></td></tr>
              <tr><td>DAX</td><td>${scores.dax}</td><td><span class="badge warning">Monitor</span></td></tr>
              <tr><td>Governance</td><td>${scores.governance}</td><td><span class="badge warning">Action</span></td></tr>
              <tr><td>Performance</td><td>${scores.performance}</td><td><span class="badge">Stable</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      gaugeEntries.forEach((entry) => {
        renderGaugeChart(`gauge-${entry.label.toLowerCase().replace(/\s+/g, '-')}`, entry.value, entry.color);
      });
    }, 0);
  }

  function renderSemantic(project) {
    const container = document.getElementById('semantic-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">Semantic model not available yet.</div>';
      return;
    }

    const tables = project.analysis.model.tables;
    const html = tables.map((table) => `
      <div class="panel-card">
        <div class="panel-title">${table.name}</div>
        <div class="mb-2 text-muted">${table.description || 'No description available'} • ${table.storageMode || 'Unknown'} • ${table.dataSource || 'No data source specified'}</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Format</th>
                <th>Hidden</th>
                <th>Key</th>
              </tr>
            </thead>
            <tbody>
              ${(table.columns || []).map((column) => `
                <tr>
                  <td>${column.name}</td>
                  <td>${column.dataType || 'Unknown'}</td>
                  <td>${column.formatString || '-'}</td>
                  <td><span class="badge ${column.hidden ? 'warning' : 'success'}">${column.hidden ? 'Yes' : 'No'}</span></td>
                  <td><span class="badge ${column.isKey ? 'success' : ''}">${column.isKey ? 'Key' : '—'}</span></td>
                </tr>
              `).join('') || '<tr><td colspan="5">No columns found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

    container.innerHTML = html || '<div class="empty-state">No model tables detected.</div>';
  }

  function renderReport(project) {
    const container = document.getElementById('report-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No report metadata found.</div>';
      return;
    }

    const pages = project.analysis.report.pages;
    const html = pages.map((page) => `
      <div class="report-card panel-card">
        <div class="panel-title">${page.displayName || page.name}</div>
        <div class="d-flex gap-3 flex-wrap mb-2">
          <span class="badge">${page.visualCount || 0} visuals</span>
          <span class="badge">${(page.visuals || []).length || 0} inventory items</span>
        </div>
        <ul class="bullet-list">
          ${(page.visuals || []).map((visual) => `<li>${visual.name || 'Unnamed Visual'} (${visual.type || 'Unknown'})</li>`).join('') || '<li>No visuals detected</li>'}
        </ul>
      </div>
    `).join('');

    container.innerHTML = html || '<div class="empty-state">No report pages found in this project.</div>';
  }

  function renderMeasures(project) {
    const container = document.getElementById('measures-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No measures available.</div>';
      return;
    }

    const measures = project.analysis.model.measures;
    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Measure review</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Table</th>
                <th>Complexity</th>
                <th>DAX</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${measures.map((measure) => `
                <tr>
                  <td>${measure.name}</td>
                  <td>${measure.table}</td>
                  <td><span class="badge ${measure.complexity === 'Very Complex' ? 'danger' : measure.complexity === 'Complex' ? 'warning' : 'success'}">${measure.complexity}</span></td>
                  <td><code>${(measure.expression || '').slice(0, 80)}</code></td>
                  <td>${(measure.notes || []).join(' ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderRelationships(project) {
    const container = document.getElementById('relationships-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No relationship metadata found.</div>';
      return;
    }

    const relationships = project.analysis.model.relationships;
    const nodes = new Set();
    relationships.forEach((relationship) => {
      nodes.add(relationship.from);
      nodes.add(relationship.to);
    });

    const mermaidDiagram = [
      'graph LR',
      ...[...nodes].map((node) => `    ${node.replace(/\s+/g, '_')}[${node}]`),
      ...relationships.map((relationship) => `    ${relationship.from.replace(/\s+/g, '_')} -->|${relationship.cardinality || 'Many-to-one'}| ${relationship.to.replace(/\s+/g, '_')}`),
    ].join('\n');

    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Relationship map</div>
        <div class="mermaid">${mermaidDiagram}</div>
      </div>
      <div class="panel-card">
        <div class="panel-title">Relationship inventory</div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Cardinality</th>
                <th>Cross filter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${relationships.map((relationship) => `
                <tr>
                  <td>${relationship.from}</td>
                  <td>${relationship.to}</td>
                  <td>${relationship.cardinality || 'Many-to-one'}</td>
                  <td>${relationship.crossFilter || 'Single'}</td>
                  <td><span class="badge ${relationship.active ? 'success' : 'warning'}">${relationship.active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      mermaid.init();
    } catch (error) {
      // Ignore Mermaid initialization issues in unsupported runtime.
    }
  }

  function renderDependencies(project) {
    const container = document.getElementById('dependencies-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">Dependency map unavailable.</div>';
      return;
    }

    const dependencyRows = [
      ...project.analysis.model.measures.map((measure) => ({
        source: measure.name,
        target: measure.table,
        type: 'Measure → Table',
      })),
      ...project.analysis.model.relationships.map((relationship) => ({
        source: relationship.from,
        target: relationship.to,
        type: 'Table → Table',
      })),
    ];

    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Dependency graph</div>
        <ul class="bullet-list">
          ${dependencyRows.map((row) => `<li>${row.source} → ${row.target} (${row.type})</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderDocumentation(project) {
    const container = document.getElementById('documentation-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No documentation generated.</div>';
      return;
    }

    const docs = project.analysis.documentation;
    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Executive summary</div>
        <p>${docs.executiveSummary.summary}</p>
      </div>
      <div class="panel-card">
        <div class="panel-title">Documentation preview</div>
        <div class="code-block">${docs.markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    `;
  }

  function renderAssessments(project) {
    const container = document.getElementById('assessments-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">No assessment available.</div>';
      return;
    }

    const scores = project.analysis.assessment.scores;
    const categories = [
      { label: 'Overall Quality', value: scores.overall },
      { label: 'Modelling Score', value: scores.modeling },
      { label: 'DAX Score', value: scores.dax },
      { label: 'Governance Score', value: scores.governance },
      { label: 'UX Score', value: scores.ux },
      { label: 'Performance Score', value: scores.performance },
      { label: 'Documentation Score', value: scores.documentation },
    ];

    container.innerHTML = `
      <div class="kpi-grid">
        ${categories.map((category) => `
          <div class="kpi-card">
            <div class="kpi-label">${category.label}</div>
            <div class="kpi-value">${category.value}</div>
            <div class="progress-box"><span style="width:${category.value}%"></span></div>
          </div>
        `).join('')}
      </div>

      <div class="panel-card">
        <div class="panel-title">Risks and recommendations</div>
        <div class="row g-3">
          <div class="col-md-6">
            <div class="list-card">
              <h5>Risks</h5>
              <ul class="risk-list">
                ${(project.analysis.assessment.risks || []).map((risk) => `<li>${risk}</li>`).join('')}
              </ul>
            </div>
          </div>
          <div class="col-md-6">
            <div class="list-card">
              <h5>Recommendations</h5>
              <ul class="recommendation-list">
                ${(project.analysis.assessment.recommendations || []).map((item) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAI(project) {
    const container = document.getElementById('ai-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">AI output not generated.</div>';
      return;
    }

    const ai = project.analysis.ai;
    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Copilot Context</div>
        <div class="code-block">${ai.contextText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
      <div class="panel-card">
        <div class="panel-title">AI Knowledge JSON</div>
        <div class="code-block">${JSON.stringify(ai.knowledgeJson, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    `;
  }

  function renderExport(project) {
    const container = document.getElementById('export-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">Upload a project to enable exports.</div>';
      return;
    }

    const summary = project.analysis.assessment.scores;
    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Export centre</div>
        <div class="button-row">
          <button class="btn btn-primary" data-export="executive-pdf">Executive PDF</button>
          <button class="btn btn-primary" data-export="technical-pdf">Technical PDF</button>
          <button class="btn btn-primary" data-export="txt">TXT</button>
          <button class="btn btn-primary" data-export="json">JSON</button>
          <button class="btn btn-primary" data-export="csv">CSV inventory</button>
        </div>
        <div class="mt-3">
          <strong>Quality Summary:</strong> ${summary.overall}/100 overall score
        </div>
      </div>
    `;

    document.querySelectorAll('[data-export]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!state.project) return;
        const type = button.getAttribute('data-export');
        if (type === 'executive-pdf') studio.exportEngine.exportExecutivePdf(state.project, state.project.analysis.assessment);
        if (type === 'technical-pdf') studio.exportEngine.exportTechnicalPdf(state.project, state.project.analysis.assessment);
        if (type === 'txt') studio.exportEngine.exportTxt(state.project, state.project.analysis.assessment);
        if (type === 'json') studio.exportEngine.exportJson(state.project, state.project.analysis.assessment);
        if (type === 'csv') studio.exportEngine.exportCsv(state.project);
      });
    });
  }

  function renderCompare() {
    const container = document.getElementById('compare-content');
    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Compare versions</div>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Version A</label>
            <input id="compare-a" type="file" class="form-control" accept=".zip,application/zip" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Version B</label>
            <input id="compare-b" type="file" class="form-control" accept=".zip,application/zip" />
          </div>
        </div>
        <div class="button-row">
          <button id="compare-run" class="btn btn-primary">Compare</button>
        </div>
      </div>
      <div id="compare-results"></div>
    `;

    document.getElementById('compare-run').addEventListener('click', async () => {
      const aFile = document.getElementById('compare-a').files[0];
      const bFile = document.getElementById('compare-b').files[0];
      if (!aFile || !bFile) {
        alert('Please select two PBIP zip files to compare.');
        return;
      }

      setLoading(true, 'Comparing versions...');
      try {
        const aProject = await studio.parser.parseProjectFromZip(aFile, aFile.name);
        const bProject = await studio.parser.parseProjectFromZip(bFile, bFile.name);
        const result = compareProjects(aProject, bProject);
        const output = document.getElementById('compare-results');
        output.innerHTML = `
          <div class="panel-card">
            <div class="panel-title">Comparison summary</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Category</th><th>Version A</th><th>Version B</th><th>Delta</th></tr></thead>
                <tbody>
                  <tr><td>Quality</td><td>${result.scores.a}</td><td>${result.scores.b}</td><td>${result.scores.delta}</td></tr>
                  <tr><td>Measures</td><td>${result.measures.a}</td><td>${result.measures.b}</td><td>${result.measures.delta}</td></tr>
                  <tr><td>Relationships</td><td>${result.relationships.a}</td><td>${result.relationships.b}</td><td>${result.relationships.delta}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel-card">
            <div class="panel-title">Differential findings</div>
            <ul class="bullet-list">
              <li><strong>Added measures:</strong> ${result.addedMeasures.length ? result.addedMeasures.join(', ') : 'None'}</li>
              <li><strong>Changed measures:</strong> ${result.changedMeasures.length ? result.changedMeasures.join(', ') : 'None'}</li>
              <li><strong>Deleted measures:</strong> ${result.deletedMeasures.length ? result.deletedMeasures.join(', ') : 'None'}</li>
              <li><strong>Relationship changes:</strong> ${result.relationshipChanges.length ? result.relationshipChanges.join(', ') : 'None'}</li>
              <li><strong>Visual changes:</strong> ${result.visualChanges.length ? result.visualChanges.join(', ') : 'None'}</li>
            </ul>
          </div>
        `;
      } catch (error) {
        console.error(error);
        alert('The comparison could not be completed. Please verify the uploaded files are valid PBIP zip packages.');
      } finally {
        setLoading(false);
      }
    });
  }

  function compareProjects(aProject, bProject) {
    const analyzeA = analyzeSimpleProject(aProject);
    const analyzeB = analyzeSimpleProject(bProject);

    const addedMeasures = analyzeB.measures.filter((measure) => !analyzeA.measures.includes(measure));
    const deletedMeasures = analyzeA.measures.filter((measure) => !analyzeB.measures.includes(measure));
    const changedMeasures = analyzeA.measures.filter((measure) => analyzeB.measures.includes(measure) && analyzeA.expressionMap[measure] !== analyzeB.expressionMap[measure]);

    const aRelationships = (aProject.model.relationships || []).map((relationship) => `${relationship.from}->${relationship.to}`);
    const bRelationships = (bProject.model.relationships || []).map((relationship) => `${relationship.from}->${relationship.to}`);
    const relationshipChanges = [
      ...bRelationships.filter((item) => !aRelationships.includes(item)),
      ...aRelationships.filter((item) => !bRelationships.includes(item)),
    ];

    const aVisuals = (aProject.report.pages || []).flatMap((page) => (page.visuals || []).map((visual) => visual.name));
    const bVisuals = (bProject.report.pages || []).flatMap((page) => (page.visuals || []).map((visual) => visual.name));
    const visualChanges = [
      ...bVisuals.filter((item) => !aVisuals.includes(item)),
      ...aVisuals.filter((item) => !bVisuals.includes(item)),
    ];

    const scoresA = computeProjectScore(aProject);
    const scoresB = computeProjectScore(bProject);

    return {
      scores: {
        a: scoresA,
        b: scoresB,
        delta: scoresB - scoresA,
      },
      measures: {
        a: analyzeA.measures.length,
        b: analyzeB.measures.length,
        delta: analyzeB.measures.length - analyzeA.measures.length,
      },
      relationships: {
        a: aRelationships.length,
        b: bRelationships.length,
        delta: bRelationships.length - aRelationships.length,
      },
      addedMeasures,
      changedMeasures,
      deletedMeasures,
      relationshipChanges,
      visualChanges,
    };
  }

  function analyzeSimpleProject(projectData) {
    const measures = (projectData.model.measures || []).map((measure) => measure.name);
    const expressionMap = {};
    (projectData.model.measures || []).forEach((measure) => {
      expressionMap[measure.name] = measure.expression || '';
    });
    return { measures, expressionMap };
  }

  function computeProjectScore(projectData) {
    if (!projectData?.analysis) {
      return 75;
    }
    const overall = projectData.analysis.assessment?.scores?.overall ?? 75;
    return overall;
  }

  function processProject(projectData) {
    const semantic = studio.semanticModel.analyze(projectData);
    const report = studio.reportAnalysis.analyze(projectData);
    const dax = studio.daxAnalyzer.analyze(semantic.measures);
    const assessment = studio.assessmentEngine.run(projectData, semantic, report, dax);
    const documentation = studio.documentationGenerator.generate(projectData, { ...assessment, model: semantic });
    const ai = studio.aiGenerator.generate(projectData, { ...assessment, model: semantic });

    projectData.analysis = {
      model: semantic,
      report,
      dax,
      assessment,
      documentation,
      ai,
      scores: assessment.scores,
    };

    return projectData;
  }

  async function loadProjectFromFiles(fileList) {
    const selectedFile = Array.from(fileList || []).find((file) => /\.zip$/i.test(file.name));
    if (selectedFile) {
      const projectData = await studio.parser.parseProjectFromZip(selectedFile, selectedFile.name);
      state.project = processProject(projectData);
      renderAll();
      return;
    }

    if (fileList && fileList.length) {
      const zip = new JSZip();
      Array.from(fileList).forEach((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        zip.file(relativePath, file);
      });
      const generated = await zip.generateAsync({ type: 'blob' });
      const projectData = await studio.parser.parseProjectFromZip(generated, 'uploaded-project.zip');
      state.project = processProject(projectData);
      renderAll();
    }
  }

  function renderAll() {
    if (!state.project) {
      setProjectTitle('No project loaded');
      setProjectStatus('Waiting for upload');
      return;
    }

    setProjectTitle(state.project.projectName);
    setProjectStatus('Project ready', 'success');
    renderOverview(state.project);
    renderSemantic(state.project);
    renderReport(state.project);
    renderMeasures(state.project);
    renderRelationships(state.project);
    renderDependencies(state.project);
    renderDocumentation(state.project);
    renderAssessments(state.project);
    renderAI(state.project);
    renderExport(state.project);
  }

  function initializeSampleProject() {
    const sample = studio.parser.buildSampleProject();
    state.project = processProject(sample);
    renderAll();
  }

  function wireEvents() {
    document.querySelectorAll('.nav-link').forEach((button) => {
      button.addEventListener('click', () => updateNav(button.dataset.target));
    });

    document.getElementById('sample-project-btn').addEventListener('click', () => {
      initializeSampleProject();
      updateNav('overview-panel');
    });

    document.getElementById('project-upload').addEventListener('change', async (event) => {
      const target = event.target;
      if (!target.files || !target.files.length) return;
      setLoading(true, 'Processing upload...');
      try {
        await loadProjectFromFiles(target.files);
      } finally {
        setLoading(false);
      }
    });

    document.getElementById('project-folder-upload').addEventListener('change', async (event) => {
      const target = event.target;
      if (!target.files || !target.files.length) return;
      setLoading(true, 'Loading PBIP folder...');
      try {
        await loadProjectFromFiles(target.files);
      } finally {
        setLoading(false);
      }
    });

    renderCompare();
  }

  document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    wireEvents();
    initializeSampleProject();
    updateNav('overview-panel');
  });
})();
