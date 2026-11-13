ROLE

You are a senior software architect, Power BI specialist, UX designer and full-stack developer.

Build a complete GitHub Pages-compatible web application called:

PBIP Insight Studio

The application analyses a Power BI PBIP project and generates comprehensive documentation, architectural assessments, quality reports and AI-ready outputs.

The application must be entirely client-side and deployable to GitHub Pages.

No backend.

No server components.

No database.

Use only:

HTML
CSS
JavaScript
Bootstrap 5
Mermaid.js
Chart.js
jsPDF
PDFMake
JSZip
All libraries should be loaded from public CDNs.



BUSINESS GOAL

The application should act as a "SonarQube for Power BI".

A user uploads a PBIP project folder (or zip file) and the application:

Parses the PBIP structure.
Analyses all semantic model metadata.
Analyses report definitions.
Generates visual documentation.
Generates technical documentation.
Generates AI context files.
Performs best-practice assessments.
Produces downloadable reports.
The application should support professional Power BI developers, architects, consultants and support teams.



SUPPORTED INPUTS

The application should support:

Option 1

Upload PBIP ZIP

Option 2

Drag and drop PBIP ZIP

Option 3

Select PBIP folder using browser folder picker

Use JSZip for ZIP extraction.



FILES TO PARSE

Support:

.pbiProject



report.json



definition.pbir



model.bim



model.tmdl



database.tmdl



table.tmdl



relationship.tmdl



measure definitions



visual containers



bookmarks



themes



connections

Automatically discover files.

Build an internal JSON object representing the complete solution.



APPLICATION SECTIONS

Create the following tabs:

Overview

Semantic Model

Report Pages

Measures

Relationships

Dependencies

Documentation

Assessments

AI Outputs

Export Centre



OVERVIEW DASHBOARD

Display:

Total tables
Total measures
Total calculated columns
Relationships
Report pages
Visual count
Data sources
Last modified date
Generate:

Complexity Score

0-100

Based upon:

measures
tables
DAX complexity
visual count
relationship count
Generate:

Technical Debt Score

0-100

Generate:

Quality Score

0-100

Display as gauges.



SEMANTIC MODEL ANALYSIS

For every table display:

Name
Description
Hidden?
Row count (when metadata available)
Data source
Storage mode
For every column:

Name
Data type
Format string
Hidden
Key column
Sort by column
For every hierarchy:

Levels
Usage
Display searchable grids.



MEASURE ANALYSIS

Extract all measures.

For every measure display:

Name
Table
DAX
Description
Dependencies
Generate automatically:

Complexity Rating

Simple

Moderate

Complex

Very Complex

Based on:

Variables
CALCULATE use
Iterators
Nested functions
Generate:

Measure Quality Notes

Provide recommendations.



DAX REVIEW ENGINE

Analyse DAX expressions.

Flag:

Hard coded values
Nested iterators
Inefficient FILTER patterns
Excessive CALCULATE nesting
Duplicate logic
Context transition risks
EARLIER usage
Deprecated patterns
Generate recommendations.



RELATIONSHIP ANALYSIS

Display relationship diagram.

Use Mermaid.

Display:

From table
To table
Cardinality
Active
Cross filter direction
Flag:

Bidirectional filters

Many-to-many relationships

Inactive relationships

Circular dependency risks

Missing date table patterns

Provide recommendations.



DEPENDENCY ANALYSIS

Build dependency graph showing:

Measures → Measures

Measures → Columns

Measures → Tables

Visuals → Measures

Pages → Visuals

Generate impact analysis.

When a measure is selected show:

"What may be affected if this changes?"



STAR SCHEMA ASSESSMENT

Determine whether model conforms to:

Star schema
Snowflake schema
Hybrid schema
Provide score.

Identify:

Fact tables
Dimension tables
Degenerate dimensions
Bridge tables
Generate recommendations.



PERFORMANCE ANALYSIS

Check for:

High cardinality columns

Excessive calculated columns

Wide tables

Large relationship chains

Auto date table usage

Hidden technical debt

Generate:

Performance score

Recommendations list

Priority ranking.



GOVERNANCE ANALYSIS

Check:

Missing descriptions

Poor naming standards

Unused measures

Unused columns

Hidden unused fields

Inconsistent formatting

Missing folders

Generate governance score.



REPORT PAGE ANALYSIS

For every report page display:

Page name
Visual count
Slicer count
Bookmark count
Visual inventory:

Cards
Tables
Matrices
Line charts
Bar charts
KPI visuals
Generate visualisations.



UX ASSESSMENT ENGINE

Assess each page against dashboard design standards.

Score:

Layout

Consistency

Accessibility

Readability

Visual Density

Navigation

Storytelling

Generate:

UX score

Strengths

Weaknesses

Recommendations



ACCESSIBILITY REVIEW

Check:

Colour contrast where available

Tab order metadata

Alt text metadata

Titles

Labels

Generate accessibility score.



DOCUMENTATION GENERATOR

Create downloadable documents.



Executive Infographic PDF

One-page A4 output.

Include:

Architecture diagram
KPIs
Complexity score
Quality score
Top risks
Solution summary


Technical Documentation PDF

Include:

Full model inventory
Tables
Columns
Measures
Relationships
Visual inventory
Quality assessment
Professional styling.

Auto-generated table of contents.



Support Handover PDF

Generate:

Architecture
Data sources
Refresh dependencies
Key measures
Risks
Recommendations


AI OUTPUT GENERATOR

Generate downloadable files.



Copilot Context TXT

Build a concise AI context file.

Include:

Business glossary
Tables
Measures
Relationships
Key calculations
Risks


AI Knowledge JSON

Generate structured JSON suitable for RAG ingestion.

Schema:

{

  "solution": {},

  "tables": [],

  "measures": [],

  "relationships": [],

  "businessDefinitions": [],

  "risks": []

}



Prompt Starter Pack

Generate prompts such as:

Explain this solution
Suggest optimisation opportunities
Review this measure
Recommend governance improvements


QUALITY SCORES

Generate:

Overall Quality Score

Modelling Score

DAX Score

Governance Score

UX Score

Performance Score

Documentation Score

Weight scores and explain calculations.



EXPORT CENTRE

Allow export of:

Executive PDF
Technical PDF
Support PDF
TXT
JSON
CSV inventories


UI REQUIREMENTS

Use a modern dark theme.

Professional Microsoft/Fabric-inspired styling.

Responsive design.

Collapsible navigation.

Search everywhere.

Filter everywhere.

Export buttons on every tab.

Charts using Chart.js.

Relationship diagrams using Mermaid.

Progress indicators during file analysis.



ARCHITECTURE REQUIREMENTS

Structure the code into modules:

index.html



css/

  styles.css



js/

  app.js

  parser.js

  semanticModel.js

  reportAnalysis.js

  daxAnalyzer.js

  assessmentEngine.js

  documentationGenerator.js

  exportEngine.js

  aiGenerator.js

Use clean object-oriented JavaScript.

Provide comments.

Provide extension points.

No placeholder logic.

Implement actual analysis logic wherever metadata is available.



FUTURE FEATURES

Design architecture to allow future addition of:

Fabric workspace analysis
XMLA endpoint connection
Semantic Link support
Tabular Editor integration
Best Practice Analyzer rules import
Deployment Pipeline analysis
Git integration
Model diff comparison
PBIX comparison mode
AI-powered remediation suggestions


Generate the complete application with all HTML, CSS and JavaScript code required to run locally or via GitHub Pages.



One extra feature I'd add before building is a "Compare Versions" capability. Upload two PBIPs and produce:

Added measures
Changed measures
Deleted measures
Relationship changes
Visual changes
Quality score delta
That feature alone would be extremely valuable during development and code reviews, and I'd include it in Version 1 of the product.

