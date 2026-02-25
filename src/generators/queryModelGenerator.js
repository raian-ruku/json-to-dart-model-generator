const { parseJsonStructure } = require("../jsonParser");

/**
 * Generate a Query Model Dart class from inferred types.
 *
 * Pattern (from user request):
 *   - Equatable class, all fields nullable
 *   - toMap: individual if (null) guards
 *   - fromMap: robust type parsing (int.tryParse, .toString(), etc.)
 *   - copyWith, toJson, fromJson, props
 *
 * @param {object} json - The parsed (and type-inferred) JSON object
 * @param {string} className - The PascalCase class name
 * @returns {string} Dart source code
 */
function generateQueryModel(json, className) {
  const { fields } = parseJsonStructure(json, className);
  const lines = [];

  // Imports
  lines.push("import 'dart:convert';");
  lines.push("import 'package:equatable/equatable.dart';");
  lines.push("");

  // Class declaration
  lines.push(`class ${className} extends Equatable {`);

  // Fields — all nullable
  for (const f of fields) {
    const nullableType = makeNullable(f.typeInfo.dartType);
    lines.push(`  final ${nullableType} ${f.camelName};`);
  }
  lines.push("");

  // Constructor
  lines.push(`  const ${className}({`);
  for (const f of fields) {
    lines.push(`    this.${f.camelName},`);
  }
  lines.push("  });");
  lines.push("");

  // copyWith
  lines.push(`  ${className} copyWith({`);
  for (const f of fields) {
    const nullableType = makeNullable(f.typeInfo.dartType);
    lines.push(`    ${nullableType} ${f.camelName},`);
  }
  lines.push("  }) {");
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    lines.push(`      ${f.camelName}: ${f.camelName} ?? this.${f.camelName},`);
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("");

  // toMap — removeWhere pattern
  lines.push("  Map<String, dynamic> toMap() {");
  lines.push("    final data = <String, dynamic>{");
  for (const f of fields) {
    lines.push(`      '${f.key}': ${f.camelName},`);
  }
  lines.push("    };");
  lines.push("");
  lines.push("    // Remove all null values");
  lines.push("    data.removeWhere((key, value) => value == null);");
  lines.push("");
  lines.push("    return data;");
  lines.push("  }");
  lines.push("");

  // fromMap — robust type parsing
  lines.push(`  factory ${className}.fromMap(Map<String, dynamic> map) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    lines.push(`      ${generateQueryFromMapAssignment(f)}`);
  }
  lines.push("    );");
  lines.push("  }");
  lines.push("");

  // toJson
  lines.push("  String toJson() => json.encode(toMap());");
  lines.push("");

  // fromJson
  lines.push(`  factory ${className}.fromJson(String source) =>`);
  lines.push(`      ${className}.fromMap(json.decode(source));`);
  lines.push("");

  // props
  lines.push("  @override");
  lines.push("  List<Object?> get props => [");
  for (const f of fields) {
    lines.push(`    ${f.camelName},`);
  }
  lines.push("  ];");

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate robust fromMap assignment for Query Models.
 * Handle int.tryParse, .toString(), and bool casting etc.
 */
function generateQueryFromMapAssignment(f) {
  const { typeInfo, key, camelName } = f;

  if (typeInfo.dartType === "int") {
    return `${camelName}: map['${key}'] is int\n          ? map['${key}']\n          : int.tryParse(map['${key}']?.toString() ?? ''),`;
  }

  if (typeInfo.dartType === "double") {
    return `${camelName}: map['${key}'] is num\n          ? (map['${key}'] as num).toDouble()\n          : double.tryParse(map['${key}']?.toString() ?? ''),`;
  }

  if (typeInfo.dartType === "bool") {
    return `${camelName}: map['${key}'] is bool ? map['${key}'] : map['${key}']?.toString() == 'true',`;
  }

  // Default to String pattern
  if (typeInfo.dartType === "String") {
    return `${camelName}: map['${key}']?.toString(),`;
  }

  return `${camelName}: map['${key}'],`;
}

/**
 * Ensure a Dart type string ends with `?` (nullable).
 */
function makeNullable(dartType) {
  if (dartType.endsWith("?")) return dartType;
  return dartType + "?";
}

module.exports = { generateQueryModel };
