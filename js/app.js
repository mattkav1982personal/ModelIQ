(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const app = (studio.app = {});
  const minimumLoadingDuration = 3000;

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

  async function withAnalysisIndicator(action) {
    const startedAt = Date.now();
    setLoading(true, 'Analyzing...');

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      return await action();
    } finally {
      const remaining = minimumLoadingDuration - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      setLoading(false);
    }
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
    if (targetId === 'relationships-panel' && state.project) {
      renderRelationships(state.project);
    }
  }

  function showWorkspace() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
  }

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
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
    const hasSemanticModel = project.metadata.semanticModelAvailable !== false;
    const cards = [
      { label: 'Total tables', value: hasSemanticModel ? summary.tableCount : 'N/A' },
      { label: 'Total measures', value: hasSemanticModel ? summary.measureCount : 'N/A' },
      { label: 'Calculated columns', value: hasSemanticModel ? summary.calculatedColumnCount : 'N/A' },
      { label: 'Relationships', value: hasSemanticModel ? summary.relationshipCount : 'N/A' },
      { label: 'Visible report pages', value: summary.visibleReportPageCount },
      { label: 'Hidden report pages', value: summary.hiddenReportPageCount },
      { label: 'Visual count', value: summary.visualCount },
    ];

    const gaugeEntries = hasSemanticModel ? [
      { label: 'Complexity', value: clamp(Math.round((summary.measureCount + summary.relationshipCount) / 2 + 20)), color: '#2ab7ff' },
      { label: 'Technical Debt', value: clamp(100 - scores.modeling + 10), color: '#ffcc66' },
      { label: 'Quality', value: scores.overall, color: '#38d39f' },
    ] : [];
    const scoreMarkup = scores.overall === null
      ? `
        <div class="panel-card">
          <div class="panel-title">Semantic model scores unavailable</div>
          <p>PBIX report pages and visuals are available for review. Table, measure and relationship counts show as unavailable, not zero, because this browser version does not decode the embedded PBIX semantic model. Load the PBIP/TMDL source for full model assessment.</p>
          <div><strong>Report UX score:</strong> ${scores.ux}/100</div>
        </div>
      `
      : `
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

    container.innerHTML = `
      ${project.metadata.analysisNotes?.map((note) => `<div class="alert alert-warning">${note}</div>`).join('') || ''}
      <div class="kpi-grid">
        ${cards.map((card) => `
          <div class="kpi-card">
            <div class="kpi-label">${card.label}</div>
            <div class="kpi-value">${card.value}</div>
          </div>
        `).join('')}
      </div>

      ${scoreMarkup}
    `;

    if (scores.overall !== null) setTimeout(() => {
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
    if (project.metadata.semanticModelAvailable === false) {
      container.innerHTML = '<div class="empty-state">PBIX semantic model metadata is not decoded in this version. Load the PBIP/TMDL source to inspect tables and columns.</div>';
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
        <div class="panel-title">${escapeHtml(page.displayName || page.name)}</div>
        <div class="d-flex gap-3 flex-wrap mb-2">
          <span class="badge">${page.visualCount || 0} visuals</span>
          <span class="badge">${(page.visuals || []).length || 0} inventory items</span>
          <span class="badge ${page.hidden ? 'warning' : 'success'}">${page.hidden ? 'Hidden' : 'Visible'}</span>
        </div>
        <ul class="bullet-list">
          ${(page.visuals || []).map((visual) => `
            <li>
              ${escapeHtml(visual.name || 'Unnamed Visual')} (${escapeHtml(visual.type || 'Unknown')})
              ${visual.tables?.length ? `<div class="small text-muted">Tables: ${visual.tables.map(escapeHtml).join(', ')}</div>` : ''}
              ${visual.fields?.length ? `<div class="small text-muted">Fields: ${visual.fields.map(escapeHtml).join(', ')}</div>` : ''}
            </li>
          `).join('') || '<li>No visuals detected</li>'}
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
    if (project.metadata.semanticModelAvailable === false) {
      container.innerHTML = '<div class="empty-state">PBIX measure definitions are not decoded in this version. Load the PBIP/TMDL source for DAX analysis.</div>';
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
    if (project.metadata.semanticModelAvailable === false) {
      container.innerHTML = '<div class="empty-state">PBIX relationships are not decoded in this version. Load the PBIP/TMDL source to review model relationships.</div>';
      return;
    }

    const relationships = project.analysis.model.relationships;
    const nodes = new Map();
    const getNodeId = (name) => {
      const tableName = String(name || 'Unknown Table');
      if (!nodes.has(tableName)) nodes.set(tableName, `table${nodes.size + 1}`);
      return nodes.get(tableName);
    };
    const escapeMermaidLabel = (value) => String(value || '')
      .replace(/&/g, '#amp;')
      .replace(/"/g, '#quot;')
      .replace(/</g, '#lt;')
      .replace(/>/g, '#gt;')
      .replace(/[\r\n]+/g, ' ');
    const getCardinalityMarkers = (relationship) => {
      const cardinality = String(relationship.cardinality || 'Many-to-one').toLowerCase().replace(/[\s-]/g, '');
      if (cardinality === 'onetoone') return { from: '1', to: '1' };
      if (cardinality === 'onetomany') return { from: '1', to: '*' };
      if (cardinality === 'manytomany') return { from: '*', to: '*' };
      return { from: '*', to: '1' };
    };
    const manySideCounts = new Map();

    relationships.forEach((relationship) => {
      getNodeId(relationship.from);
      getNodeId(relationship.to);
      const markers = getCardinalityMarkers(relationship);
      if (markers.from === '*') manySideCounts.set(relationship.from, (manySideCounts.get(relationship.from) || 0) + 1);
      if (markers.to === '*') manySideCounts.set(relationship.to, (manySideCounts.get(relationship.to) || 0) + 1);
    });

    const factTable = [...manySideCounts.entries()]
      .sort((left, right) => right[1] - left[1])[0];
    const factTableName = factTable && factTable[1] > 1 ? factTable[0] : null;
    const mermaidDiagram = [
      'flowchart TB',
      '    classDef fact fill:#0d6ea8,color:#ffffff,stroke:#1ea5d9,stroke-width:3px;',
      '    classDef dimension fill:#f8f9f7,color:#0e2847,stroke:#2aa9a3,stroke-width:1.5px;',
      ...[...nodes].map(([name, id]) => `    ${id}["${escapeMermaidLabel(name)}"]`),
      ...[...nodes].map(([name, id]) => `    class ${id} ${name === factTableName ? 'fact' : 'dimension'};`),
      ...relationships.map((relationship) => {
        const from = getNodeId(relationship.from);
        const to = getNodeId(relationship.to);
        const markers = getCardinalityMarkers(relationship);
        const fromIsOneSide = markers.from === '1' && markers.to === '*';
        const source = fromIsOneSide ? from : to;
        const target = fromIsOneSide ? to : from;
        return `    ${source} -->|${markers.from === markers.to ? `${markers.from} : ${markers.to}` : '1 : *'}| ${target}`;
      }),
    ].join('\n');

    container.innerHTML = `
      <div class="panel-card">
        <div class="panel-title">Relationship map</div>
        <div class="schema-legend">
          ${factTableName ? `<span class="schema-legend-item"><span class="schema-swatch fact"></span>Likely fact: ${escapeHtml(factTableName)}</span>` : ''}
          <span class="schema-legend-item"><span class="schema-swatch dimension"></span>Dimension</span>
          <span class="schema-legend-item"><strong>1 : *</strong> One-to-many</span>
        </div>
        <div class="mermaid"></div>
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
                  <td>${escapeHtml(relationship.from)}${relationship.fromColumn ? `<div class="small text-muted">${escapeHtml(relationship.fromColumn)}</div>` : ''}</td>
                  <td>${escapeHtml(relationship.to)}${relationship.toColumn ? `<div class="small text-muted">${escapeHtml(relationship.toColumn)}</div>` : ''}</td>
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

    const diagram = container.querySelector('.mermaid');
    diagram.textContent = mermaidDiagram;
    if (document.getElementById('relationships-panel').classList.contains('active')) {
      mermaid.run({ nodes: [diagram] }).catch((error) => {
        console.error('The relationship diagram could not be rendered.', error);
        diagram.innerHTML = '<div class="alert alert-warning mb-0">The relationship diagram could not be rendered. The relationship inventory is still available below.</div>';
      });
    }
  }

  function renderDependencies(project) {
    const container = document.getElementById('dependencies-content');
    if (!project || !project.analysis) {
      container.innerHTML = '<div class="empty-state">Dependency map unavailable.</div>';
      return;
    }
    if (project.metadata.semanticModelAvailable === false) {
      container.innerHTML = '<div class="empty-state">PBIX model dependencies are not decoded in this version. Report-level field references are listed with each visual.</div>';
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
      ${scores.overall === null ? '<div class="alert alert-warning">PBIX files provide report-level analysis only in this version. Model counts and scores are unavailable, not zero; load the PBIP/TMDL source for full semantic model assessment.</div>' : ''}
      <div class="kpi-grid">
        ${categories.map((category) => `
          <div class="kpi-card">
            <div class="kpi-label">${category.label}</div>
            <div class="kpi-value">${category.value ?? 'Not available'}</div>
            ${category.value === null ? '' : `<div class="progress-box"><span style="width:${category.value}%"></span></div>`}
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
          <strong>Quality Summary:</strong> ${summary.overall === null ? 'Not available for PBIX report-only analysis' : `${summary.overall}/100 overall score`}
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
            <input id="compare-a" type="file" accept=".zip" class="form-control" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Version B</label>
            <input id="compare-b" type="file" accept=".zip" class="form-control" />
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
        alert('Please select two PBIP ZIP archives to compare.');
        return;
      }
      if (!/\.zip$/i.test(aFile.name) || !/\.zip$/i.test(bFile.name)) {
        alert('Compare Versions accepts PBIP ZIP archives only.');
        return;
      }

      setLoading(true, 'Comparing versions...');
      try {
        const aProject = processProject(await studio.parser.parseProjectFromZip(aFile, aFile.name));
        const bProject = processProject(await studio.parser.parseProjectFromZip(bFile, bFile.name));
        if (aProject.metadata.format === 'PBIX' || bProject.metadata.format === 'PBIX') {
          throw new Error('Only PBIP project ZIP archives can be compared.');
        }
        const result = compareProjects(aProject, bProject);
        const output = document.getElementById('compare-results');
        output.innerHTML = `
          <div class="panel-card">
            <div class="panel-title">Comparison summary</div>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Category</th><th>Version A</th><th>Version B</th><th>Delta</th></tr></thead>
                <tbody>
                  <tr><td>Quality</td><td>${result.scores.a ?? 'Not available'}</td><td>${result.scores.b ?? 'Not available'}</td><td>${result.scores.delta ?? 'Not available'}</td></tr>
                  <tr><td>Measures</td><td>${result.measures.a ?? 'Not available'}</td><td>${result.measures.b ?? 'Not available'}</td><td>${result.measures.delta ?? 'Not available'}</td></tr>
                  <tr><td>Relationships</td><td>${result.relationships.a ?? 'Not available'}</td><td>${result.relationships.b ?? 'Not available'}</td><td>${result.relationships.delta ?? 'Not available'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel-card">
            <div class="panel-title">Differential findings</div>
            <ul class="bullet-list">
              <li><strong>Added measures:</strong> ${result.addedMeasures ? (result.addedMeasures.length ? result.addedMeasures.join(', ') : 'None') : 'Unavailable'}</li>
              <li><strong>Changed measures:</strong> ${result.changedMeasures ? (result.changedMeasures.length ? result.changedMeasures.join(', ') : 'None') : 'Unavailable'}</li>
              <li><strong>Deleted measures:</strong> ${result.deletedMeasures ? (result.deletedMeasures.length ? result.deletedMeasures.join(', ') : 'None') : 'Unavailable'}</li>
              <li><strong>Relationship changes:</strong> ${result.relationshipChanges ? (result.relationshipChanges.length ? result.relationshipChanges.join(', ') : 'None') : 'Unavailable'}</li>
              <li><strong>Visual changes:</strong> ${result.visualChanges.length ? result.visualChanges.join(', ') : 'None'}</li>
            </ul>
          </div>
        `;
      } catch (error) {
        console.error(error);
        alert(`The comparison could not be completed: ${error.message}`);
      } finally {
        setLoading(false);
        document.getElementById('compare-a').value = '';
        document.getElementById('compare-b').value = '';
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
    const hasSemanticModel = aProject.metadata?.semanticModelAvailable !== false
      && bProject.metadata?.semanticModelAvailable !== false;

    return {
      scores: {
        a: scoresA,
        b: scoresB,
        delta: scoresA === null || scoresB === null ? null : scoresB - scoresA,
      },
      measures: {
        a: hasSemanticModel ? analyzeA.measures.length : null,
        b: hasSemanticModel ? analyzeB.measures.length : null,
        delta: hasSemanticModel ? analyzeB.measures.length - analyzeA.measures.length : null,
      },
      relationships: {
        a: hasSemanticModel ? aRelationships.length : null,
        b: hasSemanticModel ? bRelationships.length : null,
        delta: hasSemanticModel ? bRelationships.length - aRelationships.length : null,
      },
      addedMeasures: hasSemanticModel ? addedMeasures : null,
      changedMeasures: hasSemanticModel ? changedMeasures : null,
      deletedMeasures: hasSemanticModel ? deletedMeasures : null,
      relationshipChanges: hasSemanticModel ? relationshipChanges : null,
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
    return projectData?.analysis?.assessment?.scores?.overall ?? null;
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

  async function loadProjectFromFolder(fileList) {
    const files = Array.from(fileList || []);
    const firstFolderFile = files.find((file) => file.webkitRelativePath);
    if (!firstFolderFile) {
      throw new Error('Select the PBIP project folder containing its .pbip manifest and related report/model folders.');
    }
    if (!files.some((file) => /\.(?:pbip|pbiproject)$/i.test(file.name))) {
      throw new Error('The selected folder does not contain a .pbip project manifest. Select the PBIP project root folder.');
    }

    const zip = new JSZip();
    files.forEach((file) => zip.file(file.webkitRelativePath, file));
    const generated = await zip.generateAsync({ type: 'blob' });
    const rootFolder = firstFolderFile.webkitRelativePath.split('/')[0] || 'uploaded-project';
    const projectData = await studio.parser.parseProjectFromZip(generated, `${rootFolder}.zip`);
    if (projectData.metadata.format === 'PBIX') {
      throw new Error('The selected folder contains a PBIX file, not a PBIP project. Select a folder with a .pbip manifest.');
    }
    state.project = processProject(projectData);
    showWorkspace();
    renderAll();
    updateNav('overview-panel');
  }

  function renderAll() {
    if (!state.project) {
      setProjectTitle('No project loaded');
      setProjectStatus('Waiting for upload');
      return;
    }

    setProjectTitle(state.project.projectName);
    const isPbix = state.project.metadata.format === 'PBIX';
    setProjectStatus(isPbix ? 'PBIX · report-only' : 'Project ready', isPbix ? 'warning' : 'success');
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
    showWorkspace();
    renderAll();
  }

  function wireEvents() {
    document.getElementById('landing-upload-button').addEventListener('click', () => {
      document.getElementById('project-folder-upload').click();
    });

    document.querySelectorAll('.nav-link').forEach((button) => {
      button.addEventListener('click', () => updateNav(button.dataset.target));
    });

    const loadSampleProject = async () => {
      try {
        await withAnalysisIndicator(() => {
          initializeSampleProject();
          updateNav('overview-panel');
        });
      } catch (error) {
        console.error(error);
        setProjectStatus('Sample load failed', 'warning');
        alert(error.message);
      }
    };

    document.getElementById('sample-project-btn').addEventListener('click', loadSampleProject);
    document.getElementById('landing-sample-button').addEventListener('click', loadSampleProject);

    document.getElementById('project-folder-upload').addEventListener('change', async (event) => {
      const target = event.target;
      if (!target.files || !target.files.length) return;
      const folderFile = Array.from(target.files).find((file) => file.webkitRelativePath) || target.files[0];
      const firstPath = folderFile.webkitRelativePath || folderFile.name;
      const rootFolder = firstPath.split('/')[0];
      const selectedMessage = `Selected: ${rootFolder} (${target.files.length} files)`;
      document.getElementById('project-folder-status').textContent = selectedMessage;
      document.getElementById('landing-upload-status').textContent = `${target.files.length} files selected. Analyzing your project...`;
      try {
        await withAnalysisIndicator(() => loadProjectFromFolder(target.files));
      } catch (error) {
        console.error(error);
        setProjectStatus('Upload failed', 'warning');
        document.getElementById('landing-upload-status').textContent = `Could not load folder: ${error.message}`;
        alert(error.message);
      } finally {
        target.value = '';
      }
    });

    renderCompare();
  }

  document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    wireEvents();
    updateNav('overview-panel');
  });
})();
