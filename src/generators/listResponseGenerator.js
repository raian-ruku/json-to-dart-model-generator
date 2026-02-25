const { parseJsonStructure, snakeToCamel } = require("../jsonParser");

/**
 * Generate List Response Dart model classes.
 *
 * Pattern (from list_reponse_model.dart):
 *   - Wrapper class (NOT Equatable): all top-level fields + data as List<DataType>
 *   - All constructor params use `required`
 *   - Data class with required constructor params, fromJson factory
 *   - Nested classes use fromJson
 *   - Uses int.tryParse / num.tryParse for numeric fields
 *   - Nullable fields (null in JSON) use String? with ?.toString()
 *   - Non-nullable strings use ?.toString() ?? ""
 *
 * @param {object} json - Full response JSON (top level has `message` and `data` array)
 * @param {string} baseName - PascalCase base name (e.g. "SubscriptionDetails")
 * @returns {string}
 */
function generateListResponseModel(json, baseName) {
  const wrapperClassName = `${baseName}ResponseModel`;

  // Determine the data item class name from baseName
  // e.g. "SubscriptionPlans" → data item class "SubscriptionPlan" (but user provides the name)
  const dataClassName = `${baseName}Data`;

  // Separate top-level fields: data array vs other fields
  let dataItemSchema = null;
  const wrapperFields = [];

  for (const [key, value] of Object.entries(json)) {
    if (key === "data" && Array.isArray(value)) {
      if (value.length > 0) {
        dataItemSchema = mergeArrayItems(value);
      }
      wrapperFields.push({
        key,
        camelName: "data",
        dartType: `List<${dataClassName}>`,
        isDataList: true,
        dataClassName,
      });
    } else {
      const camelName = snakeToCamel(key);
      const typeInfo = inferSimpleType(value);
      wrapperFields.push({
        key,
        camelName,
        dartType: typeInfo.dartType,
        isDataList: false,
        fromJsonExpr: typeInfo.fromJsonExpr(key),
      });
    }
  }

  const allClasses = [];

  // ========== WRAPPER CLASS ==========
  allClasses.push(
    generateWrapperClass(wrapperClassName, wrapperFields, dataClassName),
  );

  // ========== DATA ITEM CLASS + nested ==========
  if (dataItemSchema) {
    const parsed = parseJsonStructure(dataItemSchema, dataClassName);
    allClasses.push(generateListDataClass(dataClassName, parsed.fields));

    // Generate all nested classes (deduplicated)
    const seen = new Set();
    for (const nested of collectAllNested(parsed)) {
      if (!seen.has(nested.className)) {
        seen.add(nested.className);
        allClasses.push(
          generateListDataClass(nested.className, nested.parsed.fields),
        );
      }
    }
  }

  return allClasses.join("\n");
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function mergeArrayItems(items) {
  const merged = {};
  for (const item of items) {
    if (typeof item === "object" && item !== null) {
      for (const [k, v] of Object.entries(item)) {
        if (!(k in merged) || merged[k] === null || merged[k] === undefined) {
          merged[k] = v;
        }
      }
    }
  }
  return merged;
}

/**
 * Infer a simple Dart type for wrapper-level non-data fields.
 */
function inferSimpleType(value) {
  if (value === null || value === undefined) {
    return {
      dartType: "String?",
      fromJsonExpr: (key) => `json['${key}'],`,
    };
  }
  if (typeof value === "boolean") {
    return {
      dartType: "bool",
      fromJsonExpr: (key) => `json['${key}'] ?? false,`,
    };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return {
        dartType: "int",
        fromJsonExpr: (key) => `json['${key}'] ?? 0,`,
      };
    }
    return {
      dartType: "double",
      fromJsonExpr: (key) => `json['${key}'] ?? 0.0,`,
    };
  }
  if (typeof value === "string") {
    return {
      dartType: "String",
      fromJsonExpr: (key) => `json['${key}'] ?? "",`,
    };
  }
  return {
    dartType: "dynamic",
    fromJsonExpr: (key) => `json['${key}'],`,
  };
}

/**
 * Generate the wrapper class — no Equatable, all required params, fromJson.
 */
function generateWrapperClass(className, fields, dataClassName) {
  const lines = [];
  lines.push(`class ${className} {`);

  // Fields
  for (const f of fields) {
    lines.push(`  final ${f.dartType} ${f.camelName};`);
  }
  lines.push("");

  // Constructor — all required
  lines.push(`  ${className}({`);
  for (const f of fields) {
    lines.push(`    required this.${f.camelName},`);
  }
  lines.push("  });");
  lines.push("");

  // fromJson
  lines.push(`  factory ${className}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    if (f.isDataList) {
      lines.push(`      data: (json['data'] as List? ?? [])`);
      lines.push(`          .map((e) => ${dataClassName}.fromJson(e))`);
      lines.push(`          .toList(),`);
    } else {
      lines.push(`      ${f.camelName}: ${f.fromJsonExpr}`);
    }
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a data / nested class — all required params, fromJson, no Equatable.
 */
function generateListDataClass(className, fields) {
  const lines = [];
  lines.push(`class ${className} {`);

  // Fields
  for (const f of fields) {
    const dartType = resolveFieldType(f);
    lines.push(`  final ${dartType} ${f.camelName};`);
  }
  lines.push("");

  // Constructor — all required
  lines.push(`  ${className}({`);
  for (const f of fields) {
    lines.push(`    required this.${f.camelName},`);
  }
  lines.push("  });");
  lines.push("");

  // fromJson
  lines.push(`  factory ${className}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    lines.push(`      ${generateFromJsonAssignment(f)}`);
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Resolve Dart type for list-response data fields.
 * Nullable fields (null value in JSON) → Type?
 * Numeric fields that appear as mixed types → String
 */
function resolveFieldType(f) {
  const { typeInfo } = f;

  if (typeInfo.isObject) return `${typeInfo.dartType}?`;
  if (typeInfo.isList && typeInfo.nestedSchema) return typeInfo.dartType;
  if (typeInfo.isList) return typeInfo.dartType;

  // Map
  if (typeInfo.dartType === "Map<String, dynamic>")
    return "Map<String, dynamic>";

  // Null value → String?
  if (typeInfo.dartType === "String?") return "String?";

  // String fields
  if (typeInfo.dartType === "String") return "String";

  // Bool
  if (typeInfo.dartType === "bool") return "bool";

  // Int
  if (typeInfo.dartType === "int") return "int";

  // Double → num
  if (typeInfo.dartType === "double") return "num";

  return typeInfo.dartType;
}

/**
 * Generate the fromJson field assignment for a data class field.
 */
function generateFromJsonAssignment(f) {
  const { typeInfo, key, camelName } = f;

  // Nested object
  if (typeInfo.isObject) {
    return `${camelName}: json['${key}'] != null\n          ? ${typeInfo.dartType}.fromJson(json['${key}'])\n          : null,`;
  }

  // List of nested objects
  if (typeInfo.isList && typeInfo.nestedSchema) {
    return `${camelName}: (json['${key}'] as List? ?? [])\n          .map((e) => ${typeInfo.listItemType}.fromJson(e))\n          .toList(),`;
  }

  // List of primitives
  if (typeInfo.isList && !typeInfo.nestedSchema) {
    return `${camelName}: List<${typeInfo.listItemType}>.from(json['${key}'] ?? []),`;
  }

  // Map<String, dynamic>
  if (typeInfo.dartType === "Map<String, dynamic>") {
    return `${camelName}: Map<String, dynamic>.from(json['${key}'] ?? {}),`;
  }

  // Int — use int.tryParse for safety
  if (typeInfo.dartType === "int") {
    return `${camelName}: int.tryParse(json['${key}']?.toString() ?? '0') ?? 0,`;
  }

  // Double / num — use num.tryParse
  if (typeInfo.dartType === "double") {
    return `${camelName}: num.tryParse(json['${key}']?.toString() ?? '0') ?? 0,`;
  }

  // Bool
  if (typeInfo.dartType === "bool") {
    return `${camelName}: json['${key}'] ?? false,`;
  }

  // Nullable string (null value in JSON)
  if (typeInfo.dartType === "String?") {
    return `${camelName}: json['${key}']?.toString(),`;
  }

  // Non-nullable string
  if (typeInfo.dartType === "String") {
    return `${camelName}: json['${key}']?.toString() ?? "",`;
  }

  return `${camelName}: json['${key}'],`;
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

module.exports = { generateListResponseModel };
