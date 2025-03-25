import ignore from 'ignore';
import * as vscode from 'vscode';
import { join as pathJoin } from 'node:path';
import packageJson from '../package.json';

const CONFIG_SECTION = "codeownersExplorer" as const;
const HIGHLIGHT_COLOR = `${CONFIG_SECTION}.highlight` as const;
// A bit much, but helps me feel safe we're in sync with what is configured outside
type ConfigurationProperty = keyof typeof packageJson.contributes.configuration.properties;
type ConfigurationOption = ConfigurationProperty extends `${typeof CONFIG_SECTION}.${infer Option}` ? Option : never;
const [BADGE_CONFIG, HIGHLIGHT_PARENTS_CONFIG] = ["badge", "highlightParents"] as const satisfies ConfigurationOption[];

class CodeownersDecorationProvider implements vscode.FileDecorationProvider {
	private decoratedPaths = new Set<string>();
	private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
	private highlight: vscode.FileDecoration = this.highlightFromConfig(vscode.workspace.getConfiguration(CONFIG_SECTION));

	highlightFromConfig(cfg: vscode.WorkspaceConfiguration): vscode.FileDecoration {
		return {
			color: new vscode.ThemeColor(HIGHLIGHT_COLOR),
			badge: cfg.get(BADGE_CONFIG),
			propagate: cfg.get<boolean>(HIGHLIGHT_PARENTS_CONFIG),
		};
	}

	reloadConfig() {
		const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
		this.highlight = this.highlightFromConfig(cfg);
	}

	// This event is required by the interface
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
		return this.decoratedPaths.has(uri.toString()) ? this.highlight : undefined;
	}

	decorate(uri: vscode.Uri) {
		this.decoratedPaths.add(uri.toString());
	}

	affectedPaths(): vscode.Uri[] {
		return Array.from(this.decoratedPaths).map(path => vscode.Uri.parse(path));
	}

	applyDecorations() {
		const uris = this.affectedPaths();
		if (uris.length > 0) {
			this._onDidChangeFileDecorations.fire(uris);
		}
	}

	clearDecorations() {
		const uris = this.affectedPaths();
		this.decoratedPaths.clear();
		if (uris.length > 0) {
			this._onDidChangeFileDecorations.fire(uris);
		}
	}
}

async function getMatchingAndParents(root: vscode.Uri, matcher: ignore.Ignore): Promise<string[]> {
	const entries = await vscode.workspace.fs.readDirectory(root);
	const recurse = async (path: string, kind: vscode.FileType): Promise<string[]> => {
		// TODO: figure out which other paths need to be ignored - maybe even use a new Ignore instance
		if (path === ".git") {
			return [];
		}
		if (kind === vscode.FileType.File && matcher.ignores(path)) {
			return [path];
		}
		if (kind !== vscode.FileType.Directory) {
			// We don't want do deal with symlinks for now
			return [];
		}
		const relPath = pathJoin(root.fsPath, path);
		const children = await vscode.workspace.fs.readDirectory(vscode.Uri.file(relPath));

		const nestedfiles = await Promise.all(
			children.map(async child => recurse(`${path}/${child[0]}`, child[1])));

		return nestedfiles.flat();
	};

	return (await Promise.all(entries.map(entry => recurse(entry[0], entry[1])))).flat();
}

export async function activate(context: vscode.ExtensionContext) {
	const decorationProvider = new CodeownersDecorationProvider();

	// Register the provider
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);

	// Track the active editor and cursor position changes
	let activeEditor = vscode.window.activeTextEditor;

	async function updateDecorationsForCursorPosition() {
		decorationProvider.clearDecorations();

		if (!activeEditor || !activeEditor.document.fileName.endsWith('CODEOWNERS')) {
			return;
		}

		const cursorPosition = activeEditor.selection.active;
		const currentLine = activeEditor.document.lineAt(cursorPosition.line).text;

		// Skip comment lines or empty lines
		if (currentLine.trim().startsWith('#') || !currentLine.trim()) {
			return;
		}

		const [pattern, ..._ids] = currentLine.trim().split(/\s+/);

		if (!pattern) {
			return;
		}

		const workspace = vscode.workspace.workspaceFolders?.[0];
		if (!workspace) {
			return;
		}

		const ig = ignore().add(pattern);
		const allFiles = await getMatchingAndParents(workspace.uri, ig);

		for (const file of allFiles) {
			decorationProvider.decorate(
				vscode.Uri.file(pathJoin(workspace.uri.fsPath, file))
			);
		}

		decorationProvider.applyDecorations();
	}

	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(event => {
			if (event.textEditor === activeEditor) {
				updateDecorationsForCursorPosition();
			}
		})
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			activeEditor = editor;
			decorationProvider.clearDecorations();
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(CONFIG_SECTION)) {
				decorationProvider.reloadConfig();
			}
		})
	);
}

export function deactivate() { }
