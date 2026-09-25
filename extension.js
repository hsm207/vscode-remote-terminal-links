const vscode = require('vscode');
const { extractTerminalLinks, resolveRemoteFile } = require('./lib/parser');

function activate(context) {
  const provider = vscode.window.registerTerminalLinkProvider({
    provideTerminalLinks(terminalContext) {
      const workspacePaths = getWorkspacePaths();
      const resolver = (candidate) => resolveRemoteFile(candidate, workspacePaths);

      return extractTerminalLinks(terminalContext.line, resolver);
    },

    async handleTerminalLink(link) {
      await openRemoteDocument(link);
    }
  });

  context.subscriptions.push(provider);
}

function deactivate() {}

async function openRemoteDocument(link) {
  try {
    const uri = vscode.Uri.file(link.targetPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    if (link.line > 1) {
      positionEditorCursor(editor, link.line, link.col);
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `Remote Terminal Link Fixer: Could not open ${link.targetPath}: ${err.message}`
    );
  }
}

function positionEditorCursor(editor, line, col) {
  const targetLine = line - 1;
  const targetCol = Math.max(0, (col || 1) - 1);
  const pos = new vscode.Position(targetLine, targetCol);

  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

function getWorkspacePaths() {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.map((folder) => folder.uri.fsPath);
}

module.exports = {
  activate,
  deactivate
};
