(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const parser = (studio.parser = {});

  function safeJsonParse(rawText) {
    if (!rawText || !rawText.trim()) return null;
    try {
      return JSON.parse(rawText);
    } catch (error) {
      return null;
    }
  }

  function toTitleCase(value) {
    if (!value) return '';
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function normalizeTableName(name) {
    if (!name) return 'Unknown Table';
    return String(name).replace(/^['"]|['"]$/g, '').trim();
  }

  function normalizeColumn(column) {
    if (!column || typeof column !== 'object') return {};
    return {
      name: column.name || column.Name || 'Unnamed Column',
      dataType: column.dataType || column.data_type || column.DataType || 'Unknown',
      formatString: column.formatString || column.format_string || '',
      hidden: Boolean(column.hidden || column.Hidden),
      isKey: Boolean(column.isKey || column.keyColumn || column.KeyColumn),
      sortBy: column.sortByColumn || column.sort_by_column || '',
    };
  }

  function parseTmdl(content, sourceName) {
    const tables = [];
    const measures = [];
    const relationships = [];
    const dataSources = [];

    const tableRegex = /^table\s+["']?([^"'\n]+)["']?/gim;
    const tableMatches = Array.from(content.matchAll(tableRegex));

    if (tableMatches.length === 0) {
      return { tables, measures, relationships, dataSources };
    }

    tableMatches.forEach((match, index) => {
      const tableName = normalizeTableName(match[1]);
      const startIndex = match.index;
      const nextStart = tableMatches[index + 1] ? tableMatches[index + 1].index : content.length;
      const section = content.slice(startIndex, nextStart);

      const table = {
        name: tableName,
        description: '',
        dataSource: '',
        storageMode: 'Unknown',
        hidden: false,
        columns: [],
        measures: [],
        sourceName,
      };

      const lines = section.split(/\r?\n/);
      let currentColumn = null;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) return;

        if (/^description\s*=/.test(trimmed)) {
          table.description = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
        }

        if (/^dataSource\s*=/.test(trimmed)) {
          table.dataSource = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
          if (table.dataSource) dataSources.push(table.dataSource);
        }

        if (/^storageMode\s*=/.test(trimmed)) {
          table.storageMode = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
        }

        if (/^hidden\s*=/.test(trimmed)) {
          table.hidden = /true/i.test(trimmed.split('=').slice(1).join('='));
        }

        const columnMatch = trimmed.match(/^column\s+["']?([^"'\n]+)["']?/i);
        if (columnMatch) {
          currentColumn = {
            name: normalizeColumnName(columnMatch[1]),
            dataType: 'Unknown',
            formatString: '',
            hidden: false,
            isKey: false,
            sortBy: '',
          };
          table.columns.push(currentColumn);
          return;
        }

        if (currentColumn && /^\s*dataType\s*=/.test(trimmed)) {
          currentColumn.dataType = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
        }

        if (currentColumn && /^\s*formatString\s*=/.test(trimmed)) {
          currentColumn.formatString = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
        }

        if (currentColumn && /^\s*hidden\s*=/.test(trimmed)) {
          currentColumn.hidden = /true/i.test(trimmed.split('=').slice(1).join('='));
        }

        if (currentColumn && /^\s*sortByColumn\s*=/.test(trimmed)) {
          currentColumn.sortBy = trimmed.split('=').slice(1).join('=').replace(/["';]+/g, '').trim();
        }

        if (currentColumn && /^\s*isKey\s*=/.test(trimmed)) {
          currentColumn.isKey = /true/i.test(trimmed.split('=').slice(1).join('='));
        }
      });

      if (table.columns.length) {
        tables.push(table);
      }
    });

    const measureRegex = /^measure\s+["']?([^"'\n]+)["']?\s*=/gim;
    const measureMatches = Array.from(content.matchAll(measureRegex));
    measureMatches.forEach((match) => {
      const name = normalizeColumnName(match[1]);
      const startIndex = match.index;
      const nextStart = measureMatches[measureMatches.indexOf(match) + 1] ? measureMatches[measureMatches.indexOf(match) + 1].index : content.length;
      const section = content.slice(startIndex, nextStart);
      const expression = section.replace(/^measure\s+["']?[^\n]+["']?\s*=\s*/i, '').replace(/\s*;\s*$/g, '').trim();
      measures.push({
        name,
        expression,
        table: 'Unknown Table',
        description: '',
        complexity: 'Simple',
        sourceName,
      });
    });

    const relationshipRegex = /^relationship\s+([\s\S]*?)$/gim;
    const relaMatches = Array.from(content.matchAll(relationshipRegex));
    relaMatches.forEach((match) => {
      const raw = match[0].replace(/^relationship\s*/i, '').trim();
      if (!raw) return;
      const parts = raw.split(/\s+from\s+|\s+to\s+|\s+type\s+|\s+crossFilter\s+/i);
      const from = parts[1] || 'Unknown';
      const to = parts[2] || 'Unknown';
      relationships.push({
        from: normalizeTableName(from),
        to: normalizeTableName(to),
        cardinality: 'Many-to-one',
        active: true,
        crossFilter: 'Single',
        sourceName,
      });
    });

    return { tables, measures, relationships, dataSources };
  }

  function normalizeColumnName(name) {
    if (!name) return 'Unnamed';
    return String(name).replace(/^['"]|['"]$/g, '').trim();
  }

  function decodeText(bytes) {
    const hasUtf16LeBom = bytes.length > 1 && bytes[0] === 0xff && bytes[1] === 0xfe;
    const looksLikeUtf16Le = bytes.length > 1 && bytes[1] === 0;
    const content = hasUtf16LeBom ? bytes.subarray(2) : bytes;
    return new TextDecoder(hasUtf16LeBom || looksLikeUtf16Le ? 'utf-16le' : 'utf-8').decode(content);
  }

  function getVisualTitle(objects) {
    const titleItems = objects && objects.title;
    if (!Array.isArray(titleItems)) return '';

    for (const item of titleItems) {
      const value = item?.properties?.text?.expr?.Literal?.Value;
      if (typeof value === 'string') {
        return value.replace(/^['"]|['"]$/g, '').trim();
      }
    }

    return '';
  }

  function parsePbixLayout(content, sourcePath) {
    const layout = safeJsonParse(content);
    if (!layout || !Array.isArray(layout.sections)) return null;

    const pages = layout.sections.map((section, pageIndex) => {
      const visualContainers = Array.isArray(section.visualContainers) ? section.visualContainers : [];
      const visuals = visualContainers.map((container, visualIndex) => {
        const config = safeJsonParse(container.config || '') || {};
        const singleVisual = config.singleVisual || {};
        const prototypeQuery = singleVisual.prototypeQuery || {};
        const tableReferences = (Array.isArray(prototypeQuery.From) ? prototypeQuery.From : [])
          .map((source) => source.Entity)
          .filter((entity) => typeof entity === 'string' && entity.length > 0);
        const fieldReferences = Object.values(singleVisual.projections || {})
          .flat()
          .filter((projection) => projection && typeof projection === 'object')
          .map((projection) => projection.queryRef)
          .filter((queryRef) => typeof queryRef === 'string' && queryRef.length > 0);
        const type = singleVisual.visualType || 'Unknown';

        return {
          name: getVisualTitle(singleVisual.objects) || `${type} ${visualIndex + 1}`,
          type,
          tables: [...new Set(tableReferences)],
          fields: [...new Set(fieldReferences)],
          sourcePath,
        };
      });

      const name = section.name || `Page ${pageIndex + 1}`;
      return {
        name,
        displayName: section.displayName || name,
        visualCount: visualContainers.length,
        visuals,
      };
    });

    return {
      pages,
      visuals: pages.flatMap((page) => page.visuals),
    };
  }

  function parseJsonLike(source, path) {
    const data = typeof source === 'string' ? safeJsonParse(source) : source;
    if (!data || typeof data !== 'object') return null;

    const result = { tables: [], measures: [], relationships: [], pages: [], visuals: [] };

    if (Array.isArray(data.tables)) {
      result.tables = data.tables.map((table) => ({
        name: table.name || table.Name || 'Untitled Table',
        description: table.description || table.Description || '',
        columns: Array.isArray(table.columns) ? table.columns.map(normalizeColumn) : [],
        dataSource: table.dataSource || table.DataSource || '',
        storageMode: table.storageMode || table.StorageMode || 'Unknown',
        hidden: Boolean(table.hidden || table.Hidden),
        sourcePath: path,
      }));
    }

    if (Array.isArray(data.measures)) {
      result.measures = data.measures.map((measure) => ({
        name: measure.name || measure.Name || 'Unnamed Measure',
        table: measure.table || measure.Table || 'Unknown Table',
        expression: measure.expression || measure.Expression || '',
        description: measure.description || measure.Description || '',
        sourcePath: path,
      }));
    }

    if (Array.isArray(data.relationships)) {
      result.relationships = data.relationships.map((relation) => ({
        from: relation.from || relation.FromTable || 'Unknown',
        to: relation.to || relation.ToTable || 'Unknown',
        cardinality: relation.cardinality || relation.Cardinality || 'Many-to-one',
        active: relation.active !== undefined ? Boolean(relation.active) : true,
        crossFilter: relation.crossFilter || relation.CrossFilterDirection || 'Single',
        sourcePath: path,
      }));
    }

    if (Array.isArray(data.pages)) {
      result.pages = data.pages.map((page) => ({
        name: page.name || page.Name || 'Page',
        displayName: page.displayName || page.DisplayName || page.name || 'Page',
        visualCount: Array.isArray(page.visuals) ? page.visuals.length : page.visualCount || 0,
        visuals: Array.isArray(page.visuals) ? page.visuals : [],
      }));
    }

    if (Array.isArray(data.visuals)) {
      result.visuals = data.visuals.map((visual) => ({
        type: visual.type || visual.Type || 'Unknown',
        name: visual.name || visual.Name || 'Visual',
      }));
    }

    return result;
  }

  parser.parseProjectFromZip = async function parseProjectFromZip(zipFile, fileName) {
    const isPbix = /\.pbix$/i.test(fileName || '');
    let zip;
    try {
      zip = await JSZip.loadAsync(zipFile);
    } catch (error) {
      throw new Error(`Could not open "${fileName || 'the selected file'}" as a Power BI ZIP package.`);
    }

    const entries = Object.keys(zip.files)
      .filter((key) => !zip.files[key].dir)
      .sort();
    const hasPbixLayout = entries.some((entry) => entry.toLowerCase() === 'report/layout');
    if (isPbix && !hasPbixLayout) {
      throw new Error('This PBIX does not contain a readable Report/Layout entry. It may be encrypted or use an unsupported format.');
    }

    const projectData = {
      projectName: (fileName || 'pbip-project').replace(/\.(zip|pbix)$/i, '').replace(/[-_]/g, ' '),
      sourceName: fileName || 'pbip-project.zip',
      files: entries,
      metadata: {
        lastModified: new Date().toISOString(),
        format: isPbix ? 'PBIX' : 'PBIP',
        semanticModelAvailable: !isPbix,
        analysisNotes: isPbix
          ? ['PBIX report pages and visual inventory are analyzed. PBIX semantic model metadata is stored in a binary payload and is not decoded by this browser-only version.']
          : [],
      },
      model: {
        tables: [],
        measures: [],
        relationships: [],
        dataSources: [],
      },
      report: {
        pages: [],
        visuals: [],
        bookmarks: [],
      },
      raw: {
        project: null,
        reportJson: null,
        modelJson: null,
      },
    };

    for (const filePath of entries) {
      const file = zip.files[filePath];
      const lower = filePath.toLowerCase();

      if (isPbix && lower === 'report/layout') {
        const bytes = await file.async('uint8array');
        const parsedReport = parsePbixLayout(decodeText(bytes), filePath);
        if (!parsedReport) throw new Error('The PBIX report layout could not be parsed.');
        projectData.raw.reportJson = parsedReport;
        projectData.report.pages = parsedReport.pages;
        projectData.report.visuals = parsedReport.visuals;
        continue;
      }

      if (isPbix) continue;

      const isRelevantTextFile = lower.endsWith('.pbiproject')
        || lower.endsWith('report.json')
        || lower.endsWith('definition.pbir')
        || lower.endsWith('.bim')
        || lower.endsWith('.tmdl')
        || (lower.endsWith('.json') && /report|metadata|database|model/i.test(filePath));
      if (!isRelevantTextFile) continue;

      const content = await file.async('string');

      if (lower.endsWith('.pbiproject')) {
        const json = safeJsonParse(content);
        projectData.raw.project = json;
        projectData.metadata = {
          ...projectData.metadata,
          project: json,
        };
      }

      if (lower.endsWith('report.json') || lower.endsWith('definition.pbir')) {
        const json = safeJsonParse(content);
        if (json) {
          projectData.raw.reportJson = json;
          const parsedReport = parseJsonLike(json, filePath);
          projectData.report.pages = parsedReport.pages;
          projectData.report.visuals = parsedReport.visuals;
        }
      }

      if (lower.endsWith('model.bim') || lower.endsWith('.bim')) {
        const json = safeJsonParse(content);
        if (json) {
          projectData.raw.modelJson = json;
          const parsedModel = parseJsonLike(json, filePath);
          projectData.model.tables.push(...parsedModel.tables);
          projectData.model.measures.push(...parsedModel.measures);
          projectData.model.relationships.push(...parsedModel.relationships);
        }
      }

      if (lower.endsWith('.tmdl')) {
        const tmdlResult = parseTmdl(content, filePath);
        projectData.model.tables.push(...tmdlResult.tables);
        projectData.model.measures.push(...tmdlResult.measures);
        projectData.model.relationships.push(...tmdlResult.relationships);
        projectData.model.dataSources.push(...tmdlResult.dataSources);
      }

      if (lower.endsWith('.json') && /report|metadata|database|model/i.test(filePath)) {
        const json = safeJsonParse(content);
        if (json && typeof json === 'object') {
          const partial = parseJsonLike(json, filePath);
          if (partial.tables.length || partial.measures.length || partial.relationships.length) {
            projectData.model.tables.push(...partial.tables);
            projectData.model.measures.push(...partial.measures);
            projectData.model.relationships.push(...partial.relationships);
          }
        }
      }
    }

    projectData.model.tables = projectData.model.tables.map((table, index) => ({
      ...table,
      id: index + 1,
      columns: Array.isArray(table.columns) ? table.columns.map((column, colIndex) => ({
        ...normalizeColumn(column),
        id: `${index + 1}-${colIndex + 1}`,
      })) : [],
    }));

    projectData.model.measures = projectData.model.measures.map((measure, index) => ({
      ...measure,
      id: index + 1,
      table: measure.table || projectData.model.tables[0]?.name || 'Unknown Table',
    }));

    projectData.model.relationships = projectData.model.relationships.map((relationship, index) => ({
      ...relationship,
      id: index + 1,
    }));

    return projectData;
  };

  parser.buildSampleProject = function buildSampleProject() {
    return {
      projectName: 'Contoso Sales Model',
      sourceName: 'contoso-sales-model.zip',
      files: ['model.bim', 'report.json', 'definition.pbir'],
      metadata: {
        lastModified: new Date().toISOString(),
      },
      model: {
        tables: [
          {
            name: 'Sales',
            description: 'Fact table containing transactional sales data',
            dataSource: 'Azure SQL',
            storageMode: 'Import',
            columns: [
              { name: 'Order Date', dataType: 'DateTime', formatString: 'MMM yyyy', hidden: false, isKey: false, sortBy: '' },
              { name: 'Sales Amount', dataType: 'Decimal', formatString: '$#,##0.00', hidden: false, isKey: false, sortBy: '' },
              { name: 'Customer Key', dataType: 'Int64', formatString: '', hidden: false, isKey: true, sortBy: '' },
            ],
          },
          {
            name: 'Date',
            description: 'Calendar dimension',
            dataSource: 'Azure SQL',
            storageMode: 'Import',
            columns: [
              { name: 'Date', dataType: 'DateTime', formatString: 'MMM yyyy', hidden: false, isKey: true, sortBy: '' },
              { name: 'Year', dataType: 'Int64', formatString: '0', hidden: false, isKey: false, sortBy: '' },
            ],
          },
          {
            name: 'Customer',
            description: 'Customer dimension',
            dataSource: 'Azure SQL',
            storageMode: 'Import',
            columns: [
              { name: 'Customer Key', dataType: 'Int64', formatString: '', hidden: false, isKey: true, sortBy: '' },
              { name: 'Customer Name', dataType: 'String', formatString: '', hidden: false, isKey: false, sortBy: '' },
            ],
          },
        ],
        measures: [
          { name: 'Total Sales', table: 'Sales', expression: 'SUM(Sales[Sales Amount])', description: 'Aggregates all sales revenue.', sourcePath: 'sample' },
          { name: 'Sales YTD', table: 'Sales', expression: 'TOTALYTD([Total Sales], Date[Date])', description: 'Year-to-date sales trend.', sourcePath: 'sample' },
          { name: 'Average Sales Per Order', table: 'Sales', expression: 'DIVIDE([Total Sales], DISTINCTCOUNT(Sales[Order ID]))', description: 'Captures order efficiency.', sourcePath: 'sample' },
        ],
        relationships: [
          { from: 'Sales', to: 'Date', cardinality: 'Many-to-one', active: true, crossFilter: 'Single' },
          { from: 'Sales', to: 'Customer', cardinality: 'Many-to-one', active: true, crossFilter: 'Single' },
        ],
        dataSources: ['Azure SQL'],
      },
      report: {
        pages: [
          { name: 'Overview', displayName: 'Overview', visualCount: 4, visuals: [{ type: 'Card', name: 'Gross sales' }, { type: 'BarChart', name: 'Sales by month' }, { type: 'LineChart', name: 'Revenue trend' }, { type: 'Table', name: 'Top products' }] },
          { name: 'Customer Detail', displayName: 'Customer Detail', visualCount: 3, visuals: [{ type: 'Table', name: 'Customer performance' }, { type: 'KPI', name: 'Customer retention' }, { type: 'Map', name: 'Geo segmentation' }] },
        ],
        visuals: [],
        bookmarks: [],
      },
      raw: { project: null, reportJson: null, modelJson: null },
    };
  };

  parser.serializeKnowledgeJson = function serializeKnowledgeJson(projectData, analysis) {
    return JSON.stringify({
      solution: {
        name: projectData.projectName,
        dataSources: analysis?.model?.dataSources || projectData.model.dataSources || [],
        qualityScore: analysis?.scores?.overall ?? null,
      },
      tables: (analysis?.model?.tables || projectData.model.tables || []).map((table) => ({
        name: table.name,
        description: table.description || '',
        columns: Array.isArray(table.columns) ? table.columns.length : 0,
      })),
      measures: (analysis?.model?.measures || projectData.model.measures || []).map((measure) => ({
        name: measure.name,
        table: measure.table,
        description: measure.description || '',
      })),
      relationships: (analysis?.model?.relationships || projectData.model.relationships || []).map((relationship) => ({
        from: relationship.from,
        to: relationship.to,
        cardinality: relationship.cardinality || 'Many-to-one',
      })),
      businessDefinitions: [],
      risks: analysis?.risks || [],
    }, null, 2);
  };
})();
