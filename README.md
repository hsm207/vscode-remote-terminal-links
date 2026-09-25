# Remote Terminal Link Fixer for VS Code 🚀

> **Fixes broken `file://`, OSC 8 hyperlinks, and multi-line wrapped links in VS Code Remote (SSH, WSL, and DevContainers).**

---

## 💥 The Problem

If you use VS Code over **Remote-SSH**, **WSL**, or in a **DevContainer**, you have almost certainly encountered this infuriating error:

> **"Cannot find the file specified"**

When CLI tools (such as AI coding agents like Antigravity, Claude Code, test runners, or compilers) print file links in your terminal:
1. **The `file://` Remote Bug ([microsoft/vscode#211443](https://github.com/microsoft/vscode/issues/211443))**:  
   VS Code treats `file:///path` as an external URL and delegates the click to your **local client operating system** (Windows or macOS) rather than resolving it on the remote Linux host! Because the remote Linux path doesn't exist on your laptop's local drive, it fails immediately.
2. **The OSC 8 Terminal Hyperlink Trap**:  
   When a CLI emits an ANSI OSC 8 hyperlink (`\e]8;;file:///...\e\my-file.md\e]8;;\e\`), the target URL is hidden inside invisible cell metadata. VS Code's built-in OSC 8 handler dispatches it straight to the client host OS with no remote translation.
3. **The Multi-Line Wrapped Link Bug ([xtermjs/xterm.js#5793](https://github.com/xtermjs/xterm.js/issues/5793))**:  
   When long paths wrap across narrow split-terminal panes, terminal buffer line-splits cause regex matchers to evaluate only half the path, completely breaking the link.

---

## 🛠️ The Solution

This lightweight extension registers a custom **`vscode.TerminalLinkProvider`** that runs inside the **Remote Extension Host**:

- ✅ **Intercepts `file://` URIs**: Automatically strips `file://` and resolves the target directly against the remote filesystem using `vscode.workspace.openTextDocument(vscode.Uri.file(...))`.
- ✅ **Intercepts OSC 8 Anchor Text**: Detects standalone filenames (like `my_plan.md`, `index.ts`, `package.json`) in the visible terminal text and captures the click *before* VS Code's broken OSC 8 handler can hand it to your local machine.
- ✅ **Smart Workspace Resolution**: Automatically resolves relative paths and standalone filenames across your active workspace folders.
- ✅ **Line & Column Jumps**: Fully supports `#L123`, `#L123-L145`, `:123`, and `:123:45` line jumps.
- ✅ **Fixes Wrapped Lines**: Uses the unwrapped logical terminal line buffer (`TerminalLinkContext.line`) so multi-line wrapped paths work seamlessly even in narrow terminal panes.

---

## 📦 Installation

### Step 1: Build & Install Extension

Clone and package into your remote environment in one command:

```bash
git clone https://github.com/hsm207/vscode-remote-terminal-links.git /tmp/vscode-remote-terminal-links
cd /tmp/vscode-remote-terminal-links

python3 -c "
import zipfile, os
vsix_path = '/tmp/remote-terminal-links.vsix'
content_types = '''<?xml version=\"1.0\" encoding=\"utf-8\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"json\" ContentType=\"application/json\" />
  <Default Extension=\"js\" ContentType=\"application/javascript\" />
  <Default Extension=\"vsixmanifest\" ContentType=\"text/xml\" />
</Types>'''
manifest = '''<?xml version=\"1.0\" encoding=\"utf-8\"?>
<PackageManifest Version=\"2.0.0\" xmlns=\"http://schemas.microsoft.com/developer/vsx-schema/2011\">
  <Metadata>
    <Identity Id=\"remote-terminal-links\" Version=\"1.1.0\" Publisher=\"hsm207\" />
    <DisplayName>Remote Terminal Link Fixer</DisplayName>
    <Description>Fixes file:// and multi-line links in remote terminal sessions</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id=\"Microsoft.VisualStudio.Code\" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type=\"Microsoft.VisualStudio.Code.Manifest\" Path=\"extension/package.json\" Addressable=\"true\" />
  </Assets>
</PackageManifest>'''
with zipfile.ZipFile(vsix_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('extension.vsixmanifest', manifest)
    with open('package.json', 'rb') as f: z.writestr('extension/package.json', f.read())
    with open('extension.js', 'rb') as f: z.writestr('extension/extension.js', f.read())
print('Built VSIX!')
"

code --install-extension /tmp/remote-terminal-links.vsix
```

### Step 2: Reload VS Code
After installing, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
```text
Developer: Reload Window
```

---

## 🎯 Supported Link Formats

| Format | Example | Action |
|---|---|---|
| **Raw Linux Paths** | `/workspace/my-project/server.ts` | Opens file remotely |
| **`file://` URIs** | `file:///home/user/project/plan.md` | Strips `file://`, opens remotely |
| **Line Jumps** | `file:///path/to/code.ts#L42` | Opens and jumps to line 42 |
| **Gutter Line Jumps** | `/path/to/code.ts:42:15` | Opens and jumps to line 42, col 15 |
| **Standalone Filenames** | `test_plan.md` | Resolves against active workspace |

---

## 🔍 Root Cause Analysis

1. **Why does clicking `file://` or OSC 8 links in Remote-SSH fail?**  
   Because VS Code passes the link to `IOpenerService`, which routes `file://` to the client host OS (Windows/Mac) instead of the remote Linux server.
2. **Why does `IOpenerService` treat it as a local client file?**  
   Because VS Code's internal URI architecture expects remote files to carry the `vscode-remote://` scheme. Standard POSIX `file:///` URLs emitted by remote CLI programs have no remote authority tag attached.
3. **Why hasn't upstream fixed this yet?**  
   Tracking in open issue [microsoft/vscode#211443](https://github.com/microsoft/vscode/issues/211443). Translating `file://` URIs to `vscode-remote://` requires bridging the IPC layer between the terminal emulator and the host opener.
4. **Why do multi-line wrapped paths break?**  
   Tracking in [xtermjs/xterm.js#5793](https://github.com/xtermjs/xterm.js/issues/5793). When ANSI cursor movements occur, `xterm.js` doesn't flag wrapped rows, causing regex split errors.
5. **How does this extension solve it?**  
   By implementing `vscode.window.registerTerminalLinkProvider` in the Remote Extension Host, we intercept the click inside the remote container and call `vscode.workspace.openTextDocument(vscode.Uri.file(...))` directly on the remote filesystem!

---

## 📜 License

[MIT](LICENSE) © 2026 hsm207
