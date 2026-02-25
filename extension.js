const vscode = require("vscode");
const { generatePostModel } = require("./src/generators/postModelGenerator");
const {
  generateSingleResponseModel,
} = require("./src/generators/singleResponseGenerator");
const {
  generateListResponseModel,
} = require("./src/generators/listResponseGenerator");
const { generateQueryModel } = require("./src/generators/queryModelGenerator");
const { parseQueryParams } = require("./src/queryParamsParser");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("JSON to Dart Model Generator is now active!");

  const disposable = vscode.commands.registerCommand(
    "json-to-dart-model-generator.generateModelFromJson",
    async function () {
      try {
        // ── Step 1: Select model type ──
        const modelType = await vscode.window.showQuickPick(
          [
            "Post Model from JSON",
            "Response Model from JSON",
            "Query Params to Post Model from JSON",
          ],
          {
            placeHolder: "Select the model type",
            ignoreFocusOut: true,
          },
        );

        if (!modelType) {
          return;
        }

        let generatedCode = "";

        if (modelType === "Query Params to Post Model from JSON") {
          // ── Query Params flow ──
          const queryInput = await vscode.window.showInputBox({
            prompt: "Paste your query params here",
            placeHolder:
              "e.g. transaction_id=1&bank_tran_id=1&device=web&offset=1",
            ignoreFocusOut: true,
          });

          if (!queryInput) {
            return;
          }

          const parsedJson = parseQueryParams(queryInput);

          if (Object.keys(parsedJson).length === 0) {
            vscode.window.showErrorMessage(
              "No valid query parameters found. Please check your input.",
            );
            return;
          }

          const modelName = await promptModelName();
          if (!modelName) return;

          generatedCode = generateQueryModel(parsedJson, modelName);
        } else {
          // ── JSON flow (Post Model from JSON / Response Model from JSON) ──
          const jsonInput = await vscode.window.showInputBox({
            prompt: "Paste your JSON here",
            placeHolder: '{ "key": "value", ... }',
            ignoreFocusOut: true,
          });

          if (!jsonInput) {
            return;
          }

          let parsedJson;
          try {
            parsedJson = JSON.parse(jsonInput);
          } catch {
            vscode.window.showErrorMessage(
              "Invalid JSON. Please check your input and try again.",
            );
            return;
          }

          if (typeof parsedJson !== "object" || parsedJson === null) {
            vscode.window.showErrorMessage(
              "JSON must be an object. Arrays at root level are not supported.",
            );
            return;
          }

          const modelName = await promptModelName();
          if (!modelName) return;

          if (modelType === "Post Model from JSON") {
            generatedCode = generatePostModel(parsedJson, modelName);
          } else {
            // Response Model from JSON → List or Single?
            const responseType = await vscode.window.showQuickPick(
              ["Single Response", "List Response"],
              {
                placeHolder: "Select the response type",
                ignoreFocusOut: true,
              },
            );

            if (!responseType) {
              return;
            }

            if (responseType === "Single Response") {
              generatedCode = generateSingleResponseModel(
                parsedJson,
                modelName,
              );
            } else {
              generatedCode = generateListResponseModel(parsedJson, modelName);
            }
          }
        }

        // ── Save as .dart file ──
        const saveUri = await vscode.window.showSaveDialog({
          filters: { "Dart Files": ["dart"] },
          saveLabel: "Save Dart Model",
        });

        if (!saveUri) {
          return;
        }

        let filePath = saveUri.fsPath;
        if (!filePath.endsWith(".dart")) {
          filePath += ".dart";
        }

        const fileUri = vscode.Uri.file(filePath);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(
          fileUri,
          encoder.encode(generatedCode),
        );

        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage(`Dart model saved to ${filePath}`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error generating model: ${error.message}`,
        );
      }
    },
  );

  context.subscriptions.push(disposable);
}

/**
 * Prompt the user for a PascalCase model name.
 * @returns {Promise<string|undefined>}
 */
async function promptModelName() {
  const modelName = await vscode.window.showInputBox({
    prompt: "Enter the base model name (PascalCase)",
    placeHolder: "e.g. SalesInvoiceDetails, SubscriptionPlans",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Model name is required";
      }
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(value.trim())) {
        return "Model name must be PascalCase (start with uppercase letter)";
      }
      return null;
    },
  });

  return modelName ? modelName.trim() : undefined;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
