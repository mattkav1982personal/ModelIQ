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

  function normalizeTableName(name) {
    if (!name) return 'Unknown Table';
    return String(name).replace(/^['"]|['"]$/g, '').trim();
  }

  function stripTmdlQuotes(value) {
    const text = String(value || '').trim();
    const quote = text[0];
    if ((quote !== "'" && quote !== '"') || text[text.length - 1] !== quote) return text;

    for (let index = 1; index < text.length - 1; index += 1) {
      if (text[index] !== quote) continue;
      if (text[index + 1] === quote) {
        index += 1;
        continue;
      }
      return text;
    }

    return text.slice(1, -1).split(`${quote}${quote}`).join(quote);
  }

  function getTmdlProperty(line, name) {
    const match = line.match(new RegExp(`^${name}\\s*[:=]\\s*(.*?)\\s*$`, 'i'));
    return match ? stripTmdlQuotes(match[1]) : null;
  }

  function getTmdlFlag(line, name) {
    const match = line.match(new RegExp(`^${name}(?:\\s*[:=]\\s*(.*))?$`, 'i'));
    if (!match) return null;
    return match[1] === undefined || /^(true|1|yes)$/i.test(stripTmdlQuotes(match[1]));
  }

  function getPrecedingDocComment(lines, lineIndex) {
    const comments = [];
    for (let index = lineIndex - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line && comments.length === 0) continue;
      if (!line.startsWith('///')) break;
      comments.unshift(line.slice(3).trim());
    }
    return comments.join(' ').trim();
  }

  function parseTmdlColumnReference(value) {
    const match = String(value || '').trim().match(/^('(?:[^']|'')*'|[^.]+)\.(.+)$/);
    if (!match) return { table: normalizeTableName(value), column: '' };
    return {
      table: normalizeTableName(match[1]),
      column: normalizeColumnName(match[2]),
    };
  }

  function parseTmdlRelationships(content, sourceName) {
    const relationships = [];
    const relationshipRegex = /^[ \t]*relationship[ \t]+([^\r\n]+)[ \t]*$/gim;
    const matches = Array.from(content.matchAll(relationshipRegex));

    matches.forEach((match, index) => {
      const endIndex = matches[index + 1] ? matches[index + 1].index : content.length;
      const section = content.slice(match.index, endIndex);
      const property = (name) => {
        const line = section.split(/\r?\n/).map((value) => value.trim()).find((value) => new RegExp(`^${name}\\s*:`, 'i').test(value));
        return line ? getTmdlProperty(line, name) : null;
      };
      const from = parseTmdlColumnReference(property('fromColumn'));
      const to = parseTmdlColumnReference(property('toColumn'));
      if (!from.column || !to.column) return;

      const fromCardinality = property('fromCardinality')?.toLowerCase();
      const toCardinality = property('toCardinality')?.toLowerCase();
      let cardinality = 'Many-to-one';
      if (fromCardinality === 'one' && toCardinality === 'many') cardinality = 'One-to-many';
      if (fromCardinality === 'one' && toCardinality === 'one') cardinality = 'One-to-one';

      const direction = property('crossFilteringBehavior')?.toLowerCase();
      const activeLine = section.split(/\r?\n/).map((value) => value.trim()).find((value) => /^isActive(?:\s*[:=])?/i.test(value));
      relationships.push({
        name: stripTmdlQuotes(match[1]),
        from: from.table,
        fromColumn: from.column,
        to: to.table,
        toColumn: to.column,
        cardinality,
        active: activeLine ? getTmdlFlag(activeLine, 'isActive') : true,
        crossFilter: direction === 'bothdirections' ? 'Both' : 'Single',
        sourceName,
      });
    });

    return relationships;
  }

  function normalizeColumn(column) {
    if (!column || typeof column !== 'object') return {};
    return {
      name: column.name || column.Name || 'Unnamed Column',
      dataType: column.dataType || column.data_type || column.DataType || 'Unknown',
      formatString: column.formatString || column.format_string || '',
      description: column.description || column.Description || '',
      hidden: Boolean(column.hidden || column.Hidden || column.isHidden),
      isKey: Boolean(column.isKey || column.keyColumn || column.KeyColumn),
      sortBy: column.sortByColumn || column.sort_by_column || '',
    };
  }

  function parseTmdl(content, sourceName) {
    const tables = [];
    const measures = [];
    const relationships = parseTmdlRelationships(content, sourceName);
    const dataSources = [];

    const tableRegex = /^[ \t]*table[ \t]+(.+?)\s*$/gim;
    const tableMatches = Array.from(content.matchAll(tableRegex));

    if (tableMatches.length === 0) {
      return { tables, measures, relationships, dataSources };
    }

    const allLines = content.split(/\r?\n/);
    tableMatches.forEach((match, index) => {
      const tableName = normalizeTableName(match[1]);
      const startIndex = match.index;
      const nextStart = tableMatches[index + 1] ? tableMatches[index + 1].index : content.length;
      const section = content.slice(startIndex, nextStart);
      const lineIndex = content.slice(0, startIndex).split(/\r?\n/).length - 1;

      const table = {
        name: tableName,
        description: getPrecedingDocComment(allLines, lineIndex),
        dataSource: '',
        storageMode: 'Unknown',
        hidden: false,
        columns: [],
        measures: [],
        sourceName,
      };

      const lines = section.split(/\r?\n/);
      let currentColumn = null;
      let pendingDescription = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('///')) {
          pendingDescription.push(trimmed.slice(3).trim());
          return;
        }

        const tableDescription = getTmdlProperty(trimmed, 'description');
        if (tableDescription !== null) table.description = tableDescription;

        const dataSource = getTmdlProperty(trimmed, 'dataSource');
        if (dataSource !== null) table.dataSource = dataSource;

        const storageMode = getTmdlProperty(trimmed, 'storageMode') || getTmdlProperty(trimmed, 'mode');
        if (storageMode !== null) table.storageMode = storageMode;

        const tableHidden = getTmdlFlag(trimmed, 'isHidden') ?? getTmdlFlag(trimmed, 'hidden');
        if (tableHidden !== null) table.hidden = tableHidden;

        const columnMatch = trimmed.match(/^column\s+(.+)$/i);
        if (columnMatch) {
          currentColumn = {
            name: normalizeColumnName(columnMatch[1]),
            dataType: 'Unknown',
            formatString: '',
            description: pendingDescription.join(' ').trim(),
            hidden: false,
            isKey: false,
            sortBy: '',
          };
          table.columns.push(currentColumn);
          pendingDescription = [];
          return;
        }

        if (!currentColumn) return;
        const dataType = getTmdlProperty(trimmed, 'dataType');
        const formatString = getTmdlProperty(trimmed, 'formatString');
        const sortBy = getTmdlProperty(trimmed, 'sortByColumn');
        if (dataType !== null) currentColumn.dataType = dataType;
        if (formatString !== null) currentColumn.formatString = formatString;
        if (sortBy !== null) currentColumn.sortBy = sortBy;

        const columnHidden = getTmdlFlag(trimmed, 'isHidden') ?? getTmdlFlag(trimmed, 'hidden');
        if (columnHidden !== null) currentColumn.hidden = columnHidden;

        const isKey = getTmdlFlag(trimmed, 'isKey');
        if (isKey !== null) currentColumn.isKey = isKey;
      });

      tables.push(table);

      const measureRegex = /^[ \t]*measure[ \t]+(.+?)[ \t]*=[ \t]*(.*)$/gim;
      const measureMatches = Array.from(section.matchAll(measureRegex));
      measureMatches.forEach((measureMatch) => {
        const matchLine = measureMatch[0].trim();
        const equalsIndex = matchLine.indexOf('=');
        const name = normalizeColumnName(matchLine.slice('measure'.length, equalsIndex).trim());
        let expression = measureMatch[2].trim();
        const remainder = section.slice(measureMatch.index + measureMatch[0].length);

        for (const expressionLine of remainder.split(/\r?\n/)) {
          const value = expressionLine.trim();
          if (!value) continue;
          if (/^(?:\/\/\/|annotation\b|column\b|measure\b|partition\b|hierarchy\b)/i.test(value)) break;
          if (/^(?:description|formatString|displayFolder|isHidden|lineageTag|dataCategory|detailRowsDefinition|kpi|changedProperty)\s*[:=]/i.test(value)) break;
          expression = expression ? `${expression}\n${value}` : value;
        }

        const measureLineIndex = section.slice(0, measureMatch.index).split(/\r?\n/).length - 1;
        const sectionLines = section.split(/\r?\n/);
        measures.push({
          name,
          expression: expression.replace(/\s*;\s*$/, '').trim(),
          table: tableName,
          description: getPrecedingDocComment(sectionLines, measureLineIndex),
          complexity: 'Simple',
          sourceName,
        });
      });
    });

    return { tables, measures, relationships, dataSources };
  }

  function normalizeColumnName(name) {
    if (!name) return 'Unnamed';
    return stripTmdlQuotes(name);
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
    const model = data.model && typeof data.model === 'object' ? data.model : data;
    const modelTables = Array.isArray(model.tables) ? model.tables : [];

    const result = { tables: [], measures: [], relationships: [], pages: [], visuals: [], dataSources: [] };

    if (modelTables.length) {
      result.tables = modelTables.map((table) => ({
        name: table.name || table.Name || 'Untitled Table',
        description: table.description || table.Description || '',
        columns: Array.isArray(table.columns) ? table.columns.map(normalizeColumn) : [],
        dataSource: table.dataSource || table.DataSource || '',
        storageMode: table.storageMode || table.StorageMode || table.partitions?.[0]?.mode || 'Unknown',
        hidden: Boolean(table.hidden || table.Hidden || table.isHidden),
        sourcePath: path,
      }));
    }

    const measures = [
      ...(Array.isArray(model.measures) ? model.measures : []),
      ...modelTables.flatMap((table) => (Array.isArray(table.measures)
        ? table.measures.map((measure) => ({ ...measure, table: measure.table || table.name || table.Name }))
        : [])),
    ];
    if (measures.length) {
      const uniqueMeasures = new Map();
      measures.forEach((measure) => {
        const tableName = measure.table || measure.Table || 'Unknown Table';
        const name = measure.name || measure.Name || 'Unnamed Measure';
        uniqueMeasures.set(`${tableName}.${name}`, {
          name,
          table: tableName,
          expression: Array.isArray(measure.expression || measure.Expression)
            ? (measure.expression || measure.Expression).join('\n')
            : measure.expression || measure.Expression || '',
          description: measure.description || measure.Description || '',
          sourcePath: path,
        });
      });
      result.measures = [...uniqueMeasures.values()];
    }

    const relationships = Array.isArray(model.relationships) ? model.relationships : [];
    if (relationships.length) {
      result.relationships = relationships.map((relation) => ({
        from: relation.from || relation.fromTable || relation.FromTable || 'Unknown',
        fromColumn: relation.fromColumn || relation.FromColumn || '',
        to: relation.to || relation.toTable || relation.ToTable || 'Unknown',
        toColumn: relation.toColumn || relation.ToColumn || '',
        cardinality: relation.cardinality || relation.Cardinality || (
          relation.fromCardinality === 'one' && relation.toCardinality === 'many'
            ? 'One-to-many'
            : relation.fromCardinality === 'one' && relation.toCardinality === 'one'
              ? 'One-to-one'
              : 'Many-to-one'
        ),
        active: relation.active !== undefined
          ? Boolean(relation.active)
          : relation.isActive !== undefined
            ? Boolean(relation.isActive)
            : true,
        crossFilter: relation.crossFilter || relation.CrossFilterDirection || (
          /both/i.test(relation.crossFilteringBehavior || '') ? 'Both' : 'Single'
        ),
        sourcePath: path,
      }));
    }

    if (Array.isArray(model.dataSources)) {
      result.dataSources = model.dataSources.map((source) => source.name || source.Name || source.type || 'Unknown');
    }

    if (Array.isArray(data.measures) && model !== data) {
      result.measures.push(...data.measures.map((measure) => ({
        name: measure.name || measure.Name || 'Unnamed Measure',
        table: measure.table || measure.Table || 'Unknown Table',
        expression: measure.expression || measure.Expression || '',
        description: measure.description || measure.Description || '',
        sourcePath: path,
      })));
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

  function getPbipPageId(filePath) {
    const parts = filePath.split(/[\\/]/);
    const definitionIndex = parts.findIndex((part) => part.toLowerCase() === 'definition');
    if (definitionIndex < 0 || !parts[definitionIndex + 1] || parts[definitionIndex + 1].toLowerCase() !== 'pages') return null;
    const pageId = parts[definitionIndex + 2];
    return pageId && pageId.toLowerCase() !== 'pages' ? pageId : null;
  }

  function getPbipVisualReferences(queryState) {
    const tables = new Set();
    const fields = new Set();
    if (!queryState || typeof queryState !== 'object') return { tables: [], fields: [] };

    Object.values(queryState).forEach((state) => {
      (Array.isArray(state?.projections) ? state.projections : []).forEach((projection) => {
        const field = projection?.field;
        if (!field || typeof field !== 'object') return;
        Object.values(field).forEach((definition) => {
          const entity = definition?.Expression?.SourceRef?.Entity;
          const property = definition?.Property;
          if (typeof entity !== 'string' || typeof property !== 'string') return;
          tables.add(entity);
          fields.add(`${entity}.${property}`);
        });
      });
    });

    return { tables: [...tables], fields: [...fields] };
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
    if (!isPbix) {
      const nestedPbixPaths = entries.filter((entry) => /\.pbix$/i.test(entry));
      if (nestedPbixPaths.length > 1) {
        throw new Error('This ZIP contains multiple PBIX files. Select one PBIX file or ZIP a single PBIX at a time.');
      }
      if (nestedPbixPaths.length === 1) {
        const nestedPbixPath = nestedPbixPaths[0];
        const nestedPbixName = nestedPbixPath.split(/[\\/]/).pop();
        const nestedPbixBytes = await zip.files[nestedPbixPath].async('uint8array');
        const projectData = await parser.parseProjectFromZip(nestedPbixBytes, nestedPbixName);
        projectData.sourceName = fileName || nestedPbixName;
        projectData.metadata = {
          ...projectData.metadata,
          containerFormat: 'ZIP',
          analysisNotes: [
            ...(projectData.metadata.analysisNotes || []),
            `Loaded "${nestedPbixName}" from the selected ZIP archive.`,
          ],
        };
        return projectData;
      }
    }

    const pbipPages = new Map();
    let pbipPageOrder = [];
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
      const isTmdlDefinitionFile = lower.endsWith('.tmdl')
        && /(?:^|[\\/])definition[\\/].+\.tmdl$/i.test(filePath);

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
        || lower.endsWith('.pbip')
        || lower.endsWith('report.json')
        || lower.endsWith('definition.pbir')
        || lower.endsWith('.bim')
        || isTmdlDefinitionFile
        || (lower.endsWith('.json') && /report|metadata|database|model/i.test(filePath));
      if (!isRelevantTextFile) continue;

      const content = await file.async('string');
      const isPagesMetadata = /(?:^|[\\/])definition[\\/]pages[\\/]pages\.json$/i.test(filePath);
      const isPageMetadata = /(?:^|[\\/])definition[\\/]pages[\\/][^\\/]+[\\/]page\.json$/i.test(filePath);
      const isVisualMetadata = /(?:^|[\\/])definition[\\/]pages[\\/][^\\/]+[\\/]visuals[\\/][^\\/]+[\\/]visual\.json$/i.test(filePath);

      if (isPagesMetadata) {
        const json = safeJsonParse(content);
        pbipPageOrder = Array.isArray(json?.pageOrder) ? json.pageOrder : [];
        continue;
      }

      if (isPageMetadata) {
        const json = safeJsonParse(content);
        const pageId = getPbipPageId(filePath);
        if (json && pageId) {
          pbipPages.set(pageId, {
            name: json.name || pageId,
            displayName: json.displayName || json.name || pageId,
            visibility: json.visibility || 'Visible',
            hidden: json.hidden === true || /hidden/i.test(json.visibility || ''),
            visuals: [],
          });
        }
        continue;
      }

      if (isVisualMetadata) {
        const json = safeJsonParse(content);
        const pageId = getPbipPageId(filePath);
        if (json && pageId) {
          const page = pbipPages.get(pageId) || {
            name: pageId,
            displayName: pageId,
            visibility: 'Visible',
            hidden: false,
            visuals: [],
          };
          const visual = json.visual || {};
          const references = getPbipVisualReferences(visual.query?.queryState);
          const type = visual.visualType || 'Unknown';
          page.visuals.push({
            name: getVisualTitle(visual.visualContainerObjects || visual.objects) || `${type} ${page.visuals.length + 1}`,
            type,
            ...references,
            sourcePath: filePath,
          });
          pbipPages.set(pageId, page);
        }
        continue;
      }

      if (lower.endsWith('.pbiproject') || lower.endsWith('.pbip')) {
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

      if (pbipPages.size) {
        const orderedPageIds = [
          ...pbipPageOrder,
          ...[...pbipPages.keys()].filter((pageId) => !pbipPageOrder.includes(pageId)),
        ];
        projectData.report.pages = orderedPageIds
          .filter((pageId) => pbipPages.has(pageId))
          .map((pageId) => {
            const page = pbipPages.get(pageId);
            return {
              ...page,
              visualCount: page.visuals.length,
            };
          });
        projectData.report.visuals = projectData.report.pages.flatMap((page) => page.visuals);
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

      if (isTmdlDefinitionFile) {
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
