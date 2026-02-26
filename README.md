# 🚀 JSON to Dart Model Generator

<p align="center">
  <img src="https://img.shields.io/badge/Dart-0175C2?style=for-the-badge&logo=dart&logoColor=white" alt="Dart" />
  <img src="https://img.shields.io/badge/JSON-757574?style=for-the-badge&logo=json&logoColor=white" alt="JSON" />
  <img src="https://img.shields.io/badge/Version-1.1.0-green?style=for-the-badge" alt="Version" />
</p>

---

**Generate high-quality, production-ready Dart model classes instantly!**
Whether you're starting with raw JSON or URL query parameters, this extension handles the heavy lifting of boilerplate generation.

---

## ✨ Features

- **📦 Post Model from JSON**  
  Generates a full `Equatable` model with `copyWith`, `toMap`, `fromMap`, `toJson`, and `fromJson`. Perfect for request bodies!

- **🔗 Response Model from JSON (Single)**  
  Handles API responses with a wrapper class and recursive nested object parsing.

- **📑 Response Model from JSON (List)**  
  Optimized for paginated results. Includes a wrapper for metadata and a List of typed Data items with `int.tryParse` safety.

- **🔍 Query Params to Post Model from JSON**  
  The ultimate time-saver! Paste a URL query string (`?id=1&name=test`) and get a structured Dart model.

- **⚡ Flexible Output Options**
  - **Copy to Clipboard**: Instant access to your code without saving a file.
  - **Save to Current File**: Replaces the content of your active editor — ideal for rapid iteration.
  - **Save to New File**: Standard flow to create and open a new `.dart` file.

---

## 🛠️ Usage

1. **Summon the command**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. **Search**: Type `Generate Dart Model from JSON/Query Params`.
3. **Choose your weapon**:
   - 📥 **Post Model from JSON** &rarr; Paste JSON &rarr; Enter Class Name.
   - 📡 **Response Model from JSON** &rarr; Paste JSON &rarr; Select Single/List.
   - 🔎 **Query Params to Post Model from JSON** &rarr; Paste query string.
4. **Take Action**: Select what to do with your generated code:
   - 📋 **Copy to Clipboard**
   - 📄 **Save to Current File**
   - 📝 **Save to New File**

---

## 📸 Process Overview

| Feature                     | Visualization                                                                              |
| :-------------------------- | :----------------------------------------------------------------------------------------- |
| **Post Model from JSON**    | ![Post Model](https://github.com/raian-ruku/media-content/blob/main/list.gif?raw=true)     |
| **Response Model (Single)** | ![Single Model](https://github.com/raian-ruku/media-content/blob/main/single.gif?raw=true) |
| **Response Model (List)**   | ![List Model](https://github.com/raian-ruku/media-content/blob/main/list.gif?raw=true)     |
| **Query Params to Model**   | ![Query Model](https://github.com/raian-ruku/media-content/blob/main/query.gif?raw=true)   |

---

## 📜 Model Patterns

### 🔹 Post Model from JSON

```dart
class MyModel extends Equatable {
  final String? name;
  const MyModel({this.name});

  MyModel copyWith({String? name}) => ...
  Map<String, dynamic> toMap() => ...        // removeWhere null logic
  factory MyModel.fromMap(Map<String, dynamic> map) => ...
  String toJson() => json.encode(toMap());
}
```

### 🔸 Response Model from JSON (Single)

Handles API responses with a wrapper class and recursive nested object parsing.

```dart
class MyResponseModel extends Equatable {
  final String? message;
  final MyData? data;

  factory MyResponseModel.fromMap(Map<String, dynamic> map) => ...
  factory MyResponseModel.fromJson(dynamic json) => ...
}
```

### 📑 Response Model from JSON (List)

Optimized for paginated results where `data` is a list of items. Includes a wrapper for metadata and a List of typed Data items.

```dart
class MyResponseModel {
  final String message;
  final List<MyData> data;

  factory MyResponseModel.fromJson(Map<String, dynamic> json) => ...
}
```

### 🔍 Query Params to Post Model from JSON

Convert URL query strings directly into structured Dart models. Great for search and filter objects! Includes **Smart Type Inference** for `int`, `bool`, and `double`.

**Input:** `search=dart&limit=10&is_active=true`

**Resulting Pattern:**

```dart
class SearchFilter extends Equatable {
  final String? search;
  final int? limit;       // Automatically inferred as int
  final bool? isActive;   // Automatically inferred as bool

  const SearchFilter({this.search, this.limit, this.isActive});

  Map<String, dynamic> toMap() {
    final data = <String, dynamic>{
      'search': search,
      'limit': limit,
      'is_active': isActive,
    };
    data.removeWhere((key, value) => value == null);
    return data;
  }

  // Includes robust fromMap with type-safe int.tryParse and bool casting
  ...
}
```

---

## 📦 Installation

1. Open **VS Code**.
2. Go to **Extensions** (`Ctrl+Shift+X`).
3. Search for `JSON to Dart Model Generator`.
4. Click **Install**.

_Or install via VSIX: `Extensions > ... > Install from VSIX...`_

---

## ⚙️ Requirements

- **VS Code** `v1.100.0+`
- **Dart SDK** (Recommended)
- **Equatable** package (Optional, but used in generated code)

---

---

## 📜 License

This extension is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ for the Flutter Community</p>
