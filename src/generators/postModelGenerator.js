const { parseJsonStructure } = require("../jsonParser");

/**
 * Generate a Post Model from JSON Dart class from a flat JSON object.
 *
 * Pattern (from updated post_model.dart):
 *   - Single Equatable class, all fields nullable
 *   - Imports: dart:convert, equatable
 *   - copyWith
 *   - toMap: single map literal + removeWhere for null removal
 *   - fromMap: doubles use (map['key'] as num?)?.toDouble()
 *   - toJson / fromJson
 *   - props
 *
 * @param {object} json - The parsed JSON object
 * @param {string} className - The PascalCase class name
 * @returns {string} Dart source code
 */
function generatePostModel(json, className) {
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

  // toMap — single map literal + removeWhere
  lines.push("  /// ✅ Only include non-null values");
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

  // fromMap — doubles use (map['key'] as num?)?.toDouble()
  lines.push(`  factory ${className}.fromMap(Map<String, dynamic> map) {`);
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    lines.push(`      ${generateFromMapAssignment(f)}`);
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
    lines.push(`        ${f.camelName},`);
  }
  lines.push("      ];");

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate the fromMap assignment for a field.
 * Doubles use (map['key'] as num?)?.toDouble() pattern.
 */
function generateFromMapAssignment(f) {
  const { typeInfo, key, camelName } = f;

  if (typeInfo.dartType === "double") {
    return `${camelName}: (map['${key}'] as num?)?.toDouble(),`;
  }

  if (typeInfo.dartType === "Map<String, dynamic>") {
    return `${camelName}: map['${key}'],`;
  }

  // Default: direct assignment
  return `${camelName}: map['${key}'],`;
}

/**
 * Ensure a Dart type string ends with `?` (nullable).
 */
function makeNullable(dartType) {
  if (dartType.endsWith("?")) return dartType;
  return dartType + "?";
}

module.exports = { generatePostModel };
