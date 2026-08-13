import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_PATH = resolve('data-model-reference.md');
const OUTPUT_PATH = resolve('data-model-reference.erd.json');
const SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';
const META_TIME = 1786300200000;

const colors = Object.freeze({
  configuration: '#2196F3',
  master: '#4CAF50',
  transactional: '#FF9800',
  audit: '#9C27B0',
});

const sectionLayers = Object.freeze({
  1: 'configuration',
  2: 'master',
  3: 'transactional',
  4: 'transactional',
  5: 'audit',
  6: 'transactional',
  7: 'transactional',
  8: 'audit',
});

const sectionBaseY = Object.freeze({
  1: 200,
  2: 4100,
  3: 5600,
  4: 8200,
  5: 9800,
  6: 11300,
  7: 12800,
  8: 14500,
});

const expectedTableNames = Object.freeze([
  'marketplaces',
  'lenders',
  'loan_products',
  'marketplace_product_offerings',
  'offering_constitutions',
  'document_types',
  'document_type_mime_types',
  'checklist_versions',
  'document_requirements',
  'business_types',
  'employment_statuses',
  'income_types',
  'retention_classes',
  'verification_providers',
  'verification_check_types',
  'borrowers',
  'borrower_registrations',
  'persons',
  'person_identifiers',
  'borrower_persons',
  'loan_applications',
  'application_parties',
  'application_status_events',
  'application_credit_declarations',
  'application_existing_credit_facilities',
  'application_requirements',
  'application_requirement_events',
  'documents',
  'document_requirement_satisfactions',
  'document_events',
  'document_access_secrets',
  'document_secret_access_events',
  'verification_checks',
  'person_kyc_verifications',
  'borrower_registration_verifications',
  'consent_purposes',
  'consent_grants',
  'destinations',
  'destination_field_mappings',
  'submission_packages',
  'submission_events',
  'outbox_events',
  'audit_events',
]);

const columnTypeOverrides = Object.freeze({
  'application_requirements.waived_by': 'text',
  'application_requirements.waiver_reason': 'text',
  'application_requirements.waived_at': 'timestamptz',
});

const cleanMarkdown = (value) =>
  value
    .replaceAll('`', '')
    .replaceAll('**', '')
    .replace(/\s+/g, ' ')
    .trim();

const splitTopLevel = (value) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let position = 0; position < value.length; position += 1) {
    const character = value[position];
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(value.slice(start, position).trim());
      start = position + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
};

const markdownCells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

const parseDefault = (notes) => {
  const match = notes.match(/\bdefault\s+(`[^`]+`|\S+)/i);
  return match ? cleanMarkdown(match[1]) : '';
};

const parseSchemaReference = (source) => {
  const lines = source.split(/\r?\n/);
  const enums = [];
  const tables = [];
  let section = 0;

  for (let position = 0; position < lines.length; position += 1) {
    const sectionMatch = lines[position].match(/^#\s+(\d+)\b/);
    if (sectionMatch) {
      section = Number(sectionMatch[1]);
      continue;
    }

    if (lines[position].trim() === '| Enum | Values |') {
      position += 2;
      while (position < lines.length && lines[position].startsWith('|')) {
        const [name, values] = markdownCells(lines[position]);
        enums.push({ name: cleanMarkdown(name), values: cleanMarkdown(values) });
        position += 1;
      }
      position -= 1;
      continue;
    }

    const tableMatch = lines[position].match(/^#{2,3}\s+(.+)$/);
    if (!tableMatch) continue;
    const tableNames = [...tableMatch[1].matchAll(/`([^`]+)`/g)].map(
      (match) => match[1],
    );
    if (tableNames.length === 0) continue;

    let tableHeaderPosition = position + 1;
    while (
      tableHeaderPosition < lines.length &&
      tableHeaderPosition <= position + 12 &&
      !['| Column | Type | Purpose |', '| Column | Type | Notes |'].includes(
        lines[tableHeaderPosition].trim(),
      )
    ) {
      if (/^#{1,3}\s+/.test(lines[tableHeaderPosition])) break;
      tableHeaderPosition += 1;
    }
    if (
      tableHeaderPosition >= lines.length ||
      !['| Column | Type | Purpose |', '| Column | Type | Notes |'].includes(
        lines[tableHeaderPosition].trim(),
      )
    ) {
      continue;
    }

    const headingWithoutNames = tableNames.reduce(
      (value, name) => value.replace(`\`${name}\``, ''),
      tableMatch[1],
    );
    const qualifier = cleanMarkdown(headingWithoutNames.replace(/^\s*·\s*/, ''));
    const description = lines
      .slice(position + 1, tableHeaderPosition)
      .map(cleanMarkdown)
      .filter((value) => value && value !== '---')
      .join(' ');
    const columns = [];
    const constraints = [];
    position = tableHeaderPosition + 2;

    while (position < lines.length && lines[position].startsWith('|')) {
      const [rawNames = '', rawTypes = '', rawNotes = ''] = markdownCells(lines[position]);
      const notes = cleanMarkdown(rawNotes);
      if (!rawNames.trim()) {
        if (notes) constraints.push(notes);
        position += 1;
        continue;
      }

      const names = splitTopLevel(rawNames).map(cleanMarkdown);
      const parsedTypes = splitTopLevel(rawTypes).map(cleanMarkdown);
      const types =
        parsedTypes.length === names.length
          ? parsedTypes
          : names.map(() => parsedTypes[0] ?? '');

      names.forEach((columnName, columnPosition) => {
        const overrideKey = `${tableNames[0]}.${columnName}`;
        const dataType = columnTypeOverrides[overrideKey] ?? types[columnPosition];
        if (!dataType) throw new Error(`Missing type for ${overrideKey}`);
        columns.push({
          name: columnName,
          dataType,
          comment: notes,
          default: parseDefault(rawNotes),
          primaryKey: /\bPK\b/.test(notes),
          unique: /\bUNIQUE\b/i.test(notes) && !/UNIQUE\s*\(/i.test(notes),
          notNull: /\bNOT NULL\b/i.test(notes),
        });
      });
      position += 1;
    }

    for (const constraint of constraints) {
      const primaryKeyMatch = constraint.match(/^PK\s*\(([^)]+)\)/i);
      if (!primaryKeyMatch) continue;
      const primaryKeyColumns = splitTopLevel(primaryKeyMatch[1]);
      for (const primaryKeyColumn of primaryKeyColumns) {
        const item = columns.find((column) => column.name === primaryKeyColumn);
        if (!item) throw new Error(`Unknown PK column ${tableNames[0]}.${primaryKeyColumn}`);
        item.primaryKey = true;
      }
    }

    for (const name of tableNames) {
      const sectionPosition = tables.filter((table) => table.section === section).length;
      const appendOnly = /append-only/i.test(qualifier);
      tables.push({
        name,
        section,
        layer: appendOnly ? 'audit' : sectionLayers[section],
        x: 200 + (sectionPosition % 6) * 1250,
        y: sectionBaseY[section] + Math.floor(sectionPosition / 6) * 1300,
        comment: [description, qualifier, ...constraints].filter(Boolean).join(' | '),
        columns: columns.map((column) => ({ ...column })),
        constraints: [...constraints],
      });
    }
    position -= 1;
  }

  return { enums, tables };
};

const source = readFileSync(SOURCE_PATH, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const { enums, tables } = parseSchemaReference(source);

const relationships = [
  ['marketplaces', ['marketplace_id'], 'marketplace_product_offerings', ['marketplace_id']],
  ['lenders', ['lender_id'], 'marketplace_product_offerings', ['lender_id']],
  ['loan_products', ['product_code'], 'marketplace_product_offerings', ['product_code']],
  ['marketplace_product_offerings', ['offering_id'], 'offering_constitutions', ['offering_id']],
  ['document_types', ['document_type_code'], 'document_type_mime_types', ['document_type_code']],
  ['loan_products', ['product_code'], 'checklist_versions', ['product_code']],
  ['lenders', ['lender_id'], 'checklist_versions', ['lender_id']],
  ['marketplaces', ['marketplace_id'], 'checklist_versions', ['marketplace_id']],
  ['checklist_versions', ['checklist_version_id'], 'document_requirements', ['checklist_version_id']],
  ['document_types', ['document_type_code'], 'document_requirements', ['document_type_code']],
  ['destinations', ['destination_id'], 'business_types', ['destination_id']],
  ['destinations', ['destination_id'], 'employment_statuses', ['destination_id']],
  ['destinations', ['destination_id'], 'income_types', ['destination_id']],
  ['retention_classes', ['retention_class_code'], 'document_types', ['retention_class_code']],
  ['verification_providers', ['provider_code'], 'verification_check_types', ['default_provider_code']],
  ['marketplaces', ['marketplace_id'], 'borrowers', ['marketplace_id']],
  ['business_types', ['code'], 'borrowers', ['business_type_code']],
  ['marketplaces', ['marketplace_id'], 'persons', ['marketplace_id']],
  ['employment_statuses', ['code'], 'persons', ['employment_status_code']],
  ['borrowers', ['marketplace_id', 'borrower_id'], 'borrower_registrations', ['marketplace_id', 'borrower_id']],
  ['persons', ['marketplace_id', 'person_id'], 'person_identifiers', ['marketplace_id', 'person_id']],
  ['documents', ['marketplace_id', 'document_id'], 'person_identifiers', ['marketplace_id', 'source_document_id']],
  ['borrowers', ['marketplace_id', 'borrower_id'], 'borrower_persons', ['marketplace_id', 'borrower_id']],
  ['persons', ['marketplace_id', 'person_id'], 'borrower_persons', ['marketplace_id', 'person_id']],
  ['borrowers', ['marketplace_id', 'borrower_id'], 'loan_applications', ['marketplace_id', 'borrower_id']],
  ['loan_products', ['product_code'], 'loan_applications', ['product_code']],
  ['income_types', ['code'], 'loan_applications', ['income_type_code']],
  ['lenders', ['lender_id'], 'loan_applications', ['lender_id']],
  ['marketplace_product_offerings', ['offering_id'], 'loan_applications', ['offering_id']],
  ['checklist_versions', ['checklist_version_id'], 'loan_applications', ['checklist_version_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'application_parties', ['marketplace_id', 'application_id']],
  ['persons', ['marketplace_id', 'person_id'], 'application_parties', ['marketplace_id', 'person_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'application_status_events', ['marketplace_id', 'application_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'application_credit_declarations', ['marketplace_id', 'application_id']],
  ['application_parties', ['marketplace_id', 'application_party_id'], 'application_credit_declarations', ['marketplace_id', 'application_party_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'application_existing_credit_facilities', ['marketplace_id', 'application_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'application_requirements', ['marketplace_id', 'application_id']],
  ['document_requirements', ['requirement_id'], 'application_requirements', ['requirement_id']],
  ['document_types', ['document_type_code'], 'application_requirements', ['document_type_code']],
  ['application_parties', ['marketplace_id', 'application_party_id'], 'application_requirements', ['marketplace_id', 'application_party_id']],
  ['application_existing_credit_facilities', ['marketplace_id', 'facility_id'], 'application_requirements', ['marketplace_id', 'facility_id']],
  ['application_requirements', ['marketplace_id', 'application_requirement_id'], 'application_requirement_events', ['marketplace_id', 'application_requirement_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'documents', ['marketplace_id', 'application_id']],
  ['document_types', ['document_type_code'], 'documents', ['document_type_code']],
  ['borrowers', ['marketplace_id', 'borrower_id'], 'documents', ['marketplace_id', 'borrower_id']],
  ['application_parties', ['marketplace_id', 'application_party_id'], 'documents', ['marketplace_id', 'application_party_id']],
  ['application_existing_credit_facilities', ['marketplace_id', 'facility_id'], 'documents', ['marketplace_id', 'facility_id']],
  ['documents', ['marketplace_id', 'document_id'], 'documents', ['marketplace_id', 'supersedes_document_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'document_requirement_satisfactions', ['marketplace_id', 'application_id']],
  ['application_requirements', ['marketplace_id', 'application_requirement_id'], 'document_requirement_satisfactions', ['marketplace_id', 'application_requirement_id']],
  ['documents', ['marketplace_id', 'document_id'], 'document_requirement_satisfactions', ['marketplace_id', 'document_id']],
  ['documents', ['marketplace_id', 'document_id'], 'document_events', ['marketplace_id', 'document_id']],
  ['documents', ['marketplace_id', 'document_id'], 'document_access_secrets', ['marketplace_id', 'document_id']],
  ['document_access_secrets', ['secret_id'], 'document_secret_access_events', ['secret_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'verification_checks', ['marketplace_id', 'application_id']],
  ['verification_check_types', ['check_type_code'], 'verification_checks', ['check_type_code']],
  ['verification_providers', ['provider_code'], 'verification_checks', ['provider_code']],
  ['verification_checks', ['check_id'], 'verification_checks', ['retry_of_check_id']],
  ['persons', ['marketplace_id', 'person_id'], 'person_kyc_verifications', ['marketplace_id', 'person_id']],
  ['verification_providers', ['provider_code'], 'person_kyc_verifications', ['provider_code']],
  ['borrower_registrations', ['marketplace_id', 'registration_id'], 'borrower_registration_verifications', ['marketplace_id', 'registration_id']],
  ['verification_providers', ['provider_code'], 'borrower_registration_verifications', ['provider_code']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'consent_grants', ['marketplace_id', 'application_id']],
  ['persons', ['marketplace_id', 'person_id'], 'consent_grants', ['marketplace_id', 'person_id']],
  ['consent_purposes', ['purpose_code'], 'consent_grants', ['purpose_code']],
  ['destinations', ['destination_id'], 'consent_grants', ['destination_id']],
  ['lenders', ['lender_id'], 'destinations', ['lender_id']],
  ['destinations', ['destination_id'], 'destination_field_mappings', ['destination_id']],
  ['loan_applications', ['marketplace_id', 'application_id'], 'submission_packages', ['marketplace_id', 'application_id']],
  ['destinations', ['destination_id'], 'submission_packages', ['destination_id']],
  ['submission_packages', ['marketplace_id', 'package_id'], 'submission_events', ['marketplace_id', 'package_id']],
  ['marketplaces', ['marketplace_id'], 'outbox_events', ['marketplace_id']],
  ['marketplaces', ['marketplace_id'], 'audit_events', ['marketplace_id']],
];

const tableByName = new Map(tables.map((table) => [table.name, table]));

const indexDefinitions = [];
const indexSignatures = new Set();
const addIndex = (tableName, columnNames, unique, suffix = '') => {
  const signature = `${tableName}:${columnNames.join(',')}:${unique}`;
  if (indexSignatures.has(signature)) return;
  indexSignatures.add(signature);
  indexDefinitions.push({
    tableName,
    name: `${unique ? 'uq' : 'ix'}_${tableName}_${columnNames.join('_')}${suffix}`,
    columnNames,
    unique,
  });
};

for (const table of tables) {
  for (const item of table.columns) {
    if (item.unique) addIndex(table.name, [item.name], true);
    for (const inlineUnique of item.comment.matchAll(/UNIQUE\s*\(([^)]+)\)/gi)) {
      if (!/\bWHERE\b/i.test(item.comment.slice(inlineUnique.index))) {
        addIndex(table.name, splitTopLevel(inlineUnique[1]), true);
      }
    }
  }
  for (const constraint of table.constraints) {
    for (const uniqueMatch of constraint.matchAll(/UNIQUE\s*\(([^)]+)\)/gi)) {
      if (!/\bWHERE\b/i.test(constraint.slice(uniqueMatch.index))) {
        addIndex(table.name, splitTopLevel(uniqueMatch[1]), true);
      }
    }
  }
}

for (const [parentName, parentColumns, childName, childColumns] of relationships) {
  if (parentName === childName) continue;
  addIndex(childName, childColumns, false, `_fk_${parentName}`);
  if (parentColumns.length > 1) addIndex(parentName, parentColumns, true);
}

const tableId = (tableName) => `table_${tableName}`;
const columnId = (tableName, columnName) => `column_${tableName}_${columnName}`;
const relationshipId = (position, parent, child) =>
  `relationship_${position + 1}_${parent}_${child}`;
const indexId = (name) => `index_${name}`;
const indexColumnId = (indexName, columnName) =>
  `index_column_${indexName}_${columnName}`;
const meta = () => ({ updateAt: META_TIME, createAt: META_TIME });

const foreignColumnIds = new Set(
  relationships.flatMap(([, , childTable, childColumns]) =>
    childColumns.map((childColumn) => columnId(childTable, childColumn)),
  ),
);

const tableEntities = Object.fromEntries(
  tables.map((table, position) => {
    const id = tableId(table.name);
    const ids = table.columns.map((item) => columnId(table.name, item.name));
    return [
      id,
      {
        id,
        name: table.name,
        comment: table.comment,
        columnIds: ids,
        seqColumnIds: ids,
        ui: {
          x: table.x,
          y: table.y,
          zIndex: 100 + position,
          widthName: Math.max(120, table.name.length * 8),
          widthComment: 300,
          color: colors[table.layer],
        },
        meta: meta(),
      },
    ];
  }),
);

const tableColumnEntities = Object.fromEntries(
  tables.flatMap((table) =>
    table.columns.map((item) => {
      const id = columnId(table.name, item.name);
      const primaryKey = item.primaryKey;
      const foreignKey = foreignColumnIds.has(id);
      const options =
        (primaryKey ? 2 : 0) |
        (item.unique ? 4 : 0) |
        (item.notNull || primaryKey ? 8 : 0);
      return [
        id,
        {
          id,
          tableId: tableId(table.name),
          name: item.name,
          comment: item.comment,
          dataType: item.dataType,
          default: item.default,
          options,
          ui: {
            keys: (primaryKey ? 1 : 0) | (foreignKey ? 2 : 0),
            widthName: Math.max(100, item.name.length * 8),
            widthComment: Math.max(60, Math.min(300, item.comment.length * 6)),
            widthDataType: Math.max(80, item.dataType.length * 8),
            widthDefault: Math.max(60, item.default.length * 8),
          },
          meta: meta(),
        },
      ];
    }),
  ),
);

const getDirection = (parentTable, childTable) => {
  if (parentTable.name === childTable.name) return { start: 2, end: 8 };
  const deltaX = childTable.x - parentTable.x;
  const deltaY = childTable.y - parentTable.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? { start: 2, end: 1 } : { start: 1, end: 2 };
  }
  return deltaY >= 0 ? { start: 8, end: 4 } : { start: 4, end: 8 };
};

const relationshipEntities = Object.fromEntries(
  relationships.map(([parentName, parentColumns, childName, childColumns], position) => {
    const id = relationshipId(position, parentName, childName);
    const parent = tableByName.get(parentName);
    const child = tableByName.get(childName);
    const direction = getDirection(parent, child);
    return [
      id,
      {
        id,
        identification: childColumns.every((name) =>
          child.columns.find((item) => item.name === name)?.primaryKey,
        ),
        relationshipType: 4,
        startRelationshipType: 2,
        start: {
          tableId: tableId(parentName),
          columnIds: parentColumns.map((name) => columnId(parentName, name)),
          x: parent.x,
          y: parent.y,
          direction: direction.start,
        },
        end: {
          tableId: tableId(childName),
          columnIds: childColumns.map((name) => columnId(childName, name)),
          x: child.x,
          y: child.y,
          direction: direction.end,
        },
        meta: meta(),
      },
    ];
  }),
);

const indexEntities = Object.fromEntries(
  indexDefinitions.map(({ tableName, name, columnNames, unique }) => {
    const id = indexId(name);
    const ids = columnNames.map((columnName) => indexColumnId(name, columnName));
    return [
      id,
      {
        id,
        name,
        tableId: tableId(tableName),
        indexColumnIds: ids,
        seqIndexColumnIds: ids,
        unique,
        meta: meta(),
      },
    ];
  }),
);

const indexColumnEntities = Object.fromEntries(
  indexDefinitions.flatMap(({ tableName, name, columnNames }) =>
    columnNames.map((columnName) => {
      const id = indexColumnId(name, columnName);
      return [
        id,
        {
          id,
          indexId: indexId(name),
          columnId: columnId(tableName, columnName),
          orderType: 1,
          meta: meta(),
        },
      ];
    }),
  ),
);

const enumMemoValues = enums.map(({ name, values }) => `${name}: ${values}`);
const enumMemoGroups = Array.from(
  { length: Math.ceil(enumMemoValues.length / 8) },
  (_, position) => ({
    id: `memo_enums_${position + 1}`,
    value: `ENUMS ${position + 1}/${Math.ceil(enumMemoValues.length / 8)}\n${enumMemoValues
      .slice(position * 8, position * 8 + 8)
      .join('\n')}`,
    x: 200 + (position % 4) * 1900,
    y: 16800 + Math.floor(position / 4) * 1000,
    width: 1700,
    height: 850,
    color: '#009688',
  }),
);
const memos = [
  {
    id: 'memo_source',
    value: `GENERATED SOURCE\ndata-model-reference.md\nSHA-256: ${sourceHash}`,
    x: 200,
    y: 16300,
    width: 900,
    height: 220,
    color: '#455A64',
  },
  {
    id: 'memo_conventions',
    value: 'GLOBAL CONVENTIONS\nPostgreSQL 16 / Cloud SQL; UUIDv7 application-generated PKs; timestamptz timestamps; numeric(18,2) money; marketplace-leading composite tenant FKs; forced RLS on tenant tables.',
    x: 1250,
    y: 16300,
    width: 1100,
    height: 260,
    color: '#F44336',
  },
  {
    id: 'memo_legend',
    value: 'LAYER COLORS\nBlue: reference/configuration\nGreen: master data\nOrange: transactional\nPurple: append-only/audit',
    x: 2500,
    y: 16300,
    width: 650,
    height: 240,
    color: '#607D8B',
  },
  ...enumMemoGroups,
  {
    id: 'memo_inactive',
    value: 'FEATURE FLAGS\ndocument_access_secrets and document_secret_access_events are NOT ACTIVATED pending legal approval. Verification tables remain empty until provider APIs are enabled.',
    x: 3500,
    y: 16300,
    width: 1100,
    height: 280,
    color: '#FFC107',
  },
];

const memoEntities = Object.fromEntries(
  memos.map((memo, position) => [
    memo.id,
    {
      id: memo.id,
      value: memo.value,
      ui: {
        x: memo.x,
        y: memo.y,
        zIndex: 500 + position,
        width: memo.width,
        height: memo.height,
        color: memo.color,
      },
      meta: meta(),
    },
  ]),
);

const erd = {
  $schema: SCHEMA_URL,
  version: '3.0.0',
  settings: {
    width: 8000,
    height: 19500,
    scrollTop: 0,
    scrollLeft: 0,
    zoomLevel: 0.35,
    show: 511,
    database: 16,
    databaseName: 'navdhan_data_model_reference',
    canvasType: 'ERD',
    language: 1,
    tableNameCase: 8,
    columnNameCase: 8,
    bracketType: 2,
    relationshipDataTypeSync: true,
    relationshipOptimization: true,
    columnOrder: [1, 2, 4, 8, 16, 32, 64],
    maxWidthComment: 300,
    ignoreSaveSettings: 0,
  },
  doc: {
    tableIds: Object.keys(tableEntities),
    relationshipIds: Object.keys(relationshipEntities),
    indexIds: Object.keys(indexEntities),
    memoIds: Object.keys(memoEntities),
  },
  collections: {
    tableEntities,
    tableColumnEntities,
    relationshipEntities,
    indexEntities,
    indexColumnEntities,
    memoEntities,
  },
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const validate = (value) => {
  assert(enums.length === 45, `Expected 45 enums, found ${enums.length}`);
  assert(tables.length === expectedTableNames.length, `Expected ${expectedTableNames.length} tables, found ${tables.length}`);
  assert(
    expectedTableNames.every((name, position) => tables[position]?.name === name),
    'Generated table order or coverage differs from data-model-reference.md',
  );
  assert(value.version === '3.0.0', 'ERD Editor version must be 3.0.0');
  assert(value.settings.database === 16, 'Database flag must select PostgreSQL');
  assert(value.settings.width >= 2000 && value.settings.width <= 20000, 'Canvas width is out of range');
  assert(value.settings.height >= 2000 && value.settings.height <= 20000, 'Canvas height is out of range');
  assert(value.settings.zoomLevel >= 0.1 && value.settings.zoomLevel <= 1, 'Zoom is out of range');

  const collections = value.collections;
  for (const [id, table] of Object.entries(collections.tableEntities)) {
    assert(id === table.id, `Table map key mismatch: ${id}`);
    assert(table.columnIds.length === table.seqColumnIds.length, `Column order mismatch: ${id}`);
    for (const idOfColumn of table.columnIds) {
      assert(collections.tableColumnEntities[idOfColumn], `Missing column ${idOfColumn}`);
      assert(collections.tableColumnEntities[idOfColumn].tableId === id, `Column belongs to wrong table: ${idOfColumn}`);
      assert(collections.tableColumnEntities[idOfColumn].dataType, `Column type is empty: ${idOfColumn}`);
    }
  }

  for (const [id, relationship] of Object.entries(collections.relationshipEntities)) {
    assert(id === relationship.id, `Relationship map key mismatch: ${id}`);
    for (const point of [relationship.start, relationship.end]) {
      assert(collections.tableEntities[point.tableId], `Missing relationship table: ${point.tableId}`);
      for (const idOfColumn of point.columnIds) {
        const item = collections.tableColumnEntities[idOfColumn];
        assert(item, `Missing relationship column: ${idOfColumn}`);
        assert(item.tableId === point.tableId, `Relationship column belongs to wrong table: ${idOfColumn}`);
      }
    }
    assert(relationship.start.columnIds.length === relationship.end.columnIds.length, `FK arity mismatch: ${id}`);
  }

  for (const [id, index] of Object.entries(collections.indexEntities)) {
    assert(id === index.id, `Index map key mismatch: ${id}`);
    assert(collections.tableEntities[index.tableId], `Missing index table: ${index.tableId}`);
    for (const idOfIndexColumn of index.indexColumnIds) {
      const item = collections.indexColumnEntities[idOfIndexColumn];
      assert(item, `Missing index column: ${idOfIndexColumn}`);
      assert(item.indexId === id, `Index column belongs to wrong index: ${idOfIndexColumn}`);
      assert(
        collections.tableColumnEntities[item.columnId]?.tableId === index.tableId,
        `Index column belongs to wrong table: ${idOfIndexColumn}`,
      );
    }
  }
};

validate(erd);
const serialized = `${JSON.stringify(erd, null, 2)}\n`;
JSON.parse(serialized);
writeFileSync(OUTPUT_PATH, serialized, 'utf8');

console.log(
  JSON.stringify({
    source: SOURCE_PATH,
    sourceSha256: sourceHash,
    output: OUTPUT_PATH,
    enums: enums.length,
    tables: Object.keys(tableEntities).length,
    columns: Object.keys(tableColumnEntities).length,
    relationships: Object.keys(relationshipEntities).length,
    indexes: Object.keys(indexEntities).length,
    memos: Object.keys(memoEntities).length,
  }),
);
