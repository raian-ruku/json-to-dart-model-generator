const { parseJsonStructure, snakeToPascal } = require("../jsonParser");

/**
 * Generate Single Response Dart model classes.
 *
 * Pattern (from single_response_model.dart):
 *   - Wrapper Equatable class with fromMap + fromJson(dynamic) + props
 *   - Nested Equatable classes with fromMap + props
 *   - All fields nullable, const constructors
 *   - Numeric amounts → String? via ?.toString()
 *
 * @param {object} json - Full response JSON
 * @param {string} baseName - PascalCase base name (e.g. "SalesInvoiceDetails")
 * @returns {string}
 */
function generateSingleResponseModel(json, baseName) {
  const wrapperClassName = `${baseName}Model`;

  // Determine top-level wrapper fields
  const topLevelFields = [];
  let dataKey = null;
  let dataSchema = null;
  const dataClassName = `${baseName}Data`;

  for (const [key, value] of Object.entries(json)) {
    if (
      key === "data" &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      dataKey = key;
      dataSchema = value;
      topLevelFields.push({
        key,
        camelName: "data",
        dartType: `${dataClassName}?`,
        isNestedObject: true,
        nestedClassName: dataClassName,
      });
    } else {
      topLevelFields.push({
        key,
        camelName: snakeToCamel(key),
        dartType: "String?",
        isNestedObject: false,
      });
    }
  }

  const allClasses = [];

  // ========== WRAPPER CLASS ==========
  allClasses.push(
    generateEquatableClass(wrapperClassName, topLevelFields, true),
  );

  // ========== DATA CLASS + nested ==========
  if (dataSchema) {
    const parsed = parseJsonStructure(dataSchema, dataClassName);
    allClasses.push(generateDataClass(dataClassName, parsed.fields));

    // Generate all nested classes (deduplicated)
    const seen = new Set();
    for (const nested of collectAllNested(parsed)) {
      if (!seen.has(nested.className)) {
        seen.add(nested.className);
        allClasses.push(
          generateDataClass(nested.className, nested.parsed.fields),
        );
      }
    }
  }

  const imports = [
    "import 'dart:convert';",
    "import 'package:equatable/equatable.dart';",
    "",
  ];

  return imports.join("\n") + "\n" + allClasses.join("\n");
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Generate the wrapper Equatable class (has fromMap + fromJson(dynamic)).
 */
function generateEquatableClass(className, fields, isWrapper) {
  const lines = [];
  lines.push(`class ${className} extends Equatable {`);

  // Fields
  for (const f of fields) {
    lines.push(`  final ${f.dartType} ${f.camelName};`);
  }
  lines.push("");

  // Constructor
  lines.push(
    `  const ${className}({${fields.map((f) => `this.${f.camelName}`).join(", ")}});`,
  );
  lines.push("");

  // fromMap
  lines.push(`  factory ${className}.fromMap(Map<String, dynamic> map) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    if (f.isNestedObject) {
      lines.push(`      ${f.camelName}: map['${f.key}'] != null`);
      lines.push(`          ? ${f.nestedClassName}.fromMap(map['${f.key}'])`);
      lines.push(`          : null,`);
    } else {
      lines.push(`      ${f.camelName}: map['${f.key}'],`);
    }
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("");

  // fromJson(dynamic)
  if (isWrapper) {
    lines.push(`  factory ${className}.fromJson(dynamic json) {`);
    lines.push(`    if (json is String) {`);
    lines.push(`      return ${className}.fromMap(jsonDecode(json));`);
    lines.push(`    }`);
    lines.push(`    return ${className}.fromMap(json);`);
    lines.push(`  }`);
    lines.push("");
  }

  // props
  lines.push("  @override");
  lines.push("  List<Object?> get props => [");
  for (const f of fields) {
    lines.push(`        ${f.camelName},`);
  }
  lines.push("      ];");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a nested data Equatable class (fromMap + props, no fromJson wrapper).
 */
function generateDataClass(className, fields) {
  const lines = [];
  lines.push(`class ${className} extends Equatable {`);

  // Fields — all nullable
  for (const f of fields) {
    const dartType = makeNullable(resolveFieldType(f));
    lines.push(`  final ${dartType} ${f.camelName};`);
  }
  lines.push("");

  // Constructor
  lines.push(`  const ${className}({`);
  for (const f of fields) {
    lines.push(`    this.${f.camelName},`);
  }
  lines.push("  });");
  lines.push("");

  // fromMap
  lines.push(`  factory ${className}.fromMap(Map<String, dynamic> map) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    lines.push(`      ${generateFromMapAssignment(f)}`);
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("");

  // props
  lines.push("  @override");
  lines.push("  List<Object?> get props => [");
  for (const f of fields) {
    lines.push(`        ${f.camelName},`);
  }
  lines.push("      ];");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Resolve the Dart type for a field, converting numeric amounts to String.
 */
function resolveFieldType(f) {
  const { typeInfo } = f;

  // Nested object
  if (typeInfo.isObject) return typeInfo.dartType;

  // List of nested objects
  if (typeInfo.isList && typeInfo.nestedSchema) return typeInfo.dartType;

  // List of primitives
  if (typeInfo.isList) return typeInfo.dartType;

  // Numeric fields that should be String (amounts, prices, quantities, totals)
  const numericAsStringKeys = [
    "amount",
    "price",
    "total",
    "quantity",
    "qty",
    "percent",
    "rate",
    "weight",
  ];
  if (
    (typeInfo.dartType === "int" || typeInfo.dartType === "double") &&
    numericAsStringKeys.some((k) => f.key.toLowerCase().includes(k))
  ) {
    return "String";
  }

  return typeInfo.dartType;
}

/**
 * Generate the fromMap assignment for a single field.
 */
function generateFromMapAssignment(f) {
  const { typeInfo, key, camelName } = f;

  // Nested object
  if (typeInfo.isObject) {
    return `${camelName}: map['${key}'] != null\n          ? ${typeInfo.dartType}.fromMap(map['${key}'])\n          : null,`;
  }

  // List of nested objects
  if (typeInfo.isList && typeInfo.nestedSchema) {
    return `${camelName}: map['${key}'] != null\n          ? List<${typeInfo.listItemType}>.from(\n              map['${key}']?.map((x) => ${typeInfo.listItemType}.fromMap(x)),\n            )\n          : [],`;
  }

  // List of primitives
  if (typeInfo.isList && !typeInfo.nestedSchema) {
    return `${camelName}: map['${key}'] != null\n          ? List<${typeInfo.listItemType}>.from(map['${key}'])\n          : [],`;
  }

  // Numeric fields rendered as String? via ?.toString()
  const resolvedType = resolveFieldType(f);
  if (
    resolvedType === "String" &&
    (typeInfo.dartType === "int" || typeInfo.dartType === "double")
  ) {
    return `${camelName}: map['${key}']?.toString(),`;
  }

  // Bool
  if (typeInfo.dartType === "bool") {
    return `${camelName}: map['${key}'],`;
  }

  // Int
  if (typeInfo.dartType === "int") {
    return `${camelName}: map['${key}'],`;
  }

  // Double / num
  if (typeInfo.dartType === "double") {
    return `${camelName}: map['${key}'],`;
  }

  // Map
  if (typeInfo.dartType === "Map<String, dynamic>") {
    return `${camelName}: Map<String, dynamic>.from(map['${key}'] ?? {}),`;
  }

  // Default — String or dynamic
  return `${camelName}: map['${key}'],`;
}

function makeNullable(dartType) {
  if (dartType.endsWith("?")) return dartType;
  // Don't double-nullable lists or maps
  if (dartType.startsWith("List<") || dartType.startsWith("Map<"))
    return dartType + "?";
  return dartType + "?";
}

/**
 * Recursively collect all nested class definitions.
 */
function collectAllNested(parsed) {
  const result = [];
  for (const nested of parsed.nestedClasses || []) {
    result.push(nested);
    if (nested.parsed && nested.parsed.nestedClasses) {
      result.push(...collectAllNested(nested.parsed));
    }
  }
  return result;
}

module.exports = { generateSingleResponseModel };
