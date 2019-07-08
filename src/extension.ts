// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { window } from 'vscode';

import * as cloud from './clound';


export function activate(context: vscode.ExtensionContext) {
	const cloudPinyin = new cloud.CloudPinyin();
	context.subscriptions.push(cloudPinyin);

	const pinyin_state = new PinyinState(cloudPinyin);

	let enabled = false;

	context.subscriptions.push(vscode.commands.registerCommand('google-pinyin.toggle', () => {
		enabled = !enabled;
		vscode.commands.executeCommand("setContext", "google-pinyin.enabled", enabled);
		vscode.commands.executeCommand("setContext", "google-pinyin.selecting", false);
		if (!enabled) {
			pinyin_state.hide();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('google-pinyin.pageup', () => {
		pinyin_state.pageup();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('google-pinyin.pagedown', () => {
		pinyin_state.pagedown();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('google-pinyin.accept', () => {
		pinyin_state.onDidAccept();
	}));

	for (let i = 0; i < 26; i += 1) {
		const ch = String.fromCharCode('a'.charCodeAt(0) + i);
		context.subscriptions.push(vscode.commands.registerCommand('google-pinyin.typing.' + ch, () => {
			pinyin_state.typing(ch);
		}));
	}

}

type MyQuickPickItem = vscode.QuickPickItem
	& { result: cloud.SearchResult };

class PinyinState {
	readonly quickPick = window.createQuickPick<MyQuickPickItem>();
	index_updated = 0;
	index = 0;
	page = 0;
	constructor(readonly cloudPinyin: cloud.CloudPinyin) {
		this.quickPick.onDidChangeValue(() => this.onDidChangeValue());
		// this.quickPick.onDidChangeValue(this.onDidChangeValue);
		this.quickPick.onDidAccept(() => this.onDidAccept());
		this.quickPick.onDidHide(() => this.onDidHide());
		// const show = (label: string) => (event: any) => {
		// 	window.showInformationMessage(label + " : " + event);
		// };
		// quickPick.onDidAccept(show("onDidAccept"));
		// quickPick.onDidChangeValue(show("onDidChangeValue"));
		// this.quickPick.onDidTriggerButton(show("onDidTriggerButton"));
		// this.quickPick.onDidChangeSelection(show("onDidChangeSelection"));
	}
	show() {
		vscode.commands.executeCommand("setContext", "extension.seleting", true);
		this.quickPick.show();
	}

	pageup() {
		if (this.page > 0) {
			this.page -= 1;
		}
		this.searchAndShow();
	}

	pagedown() {
		this.page += 1;
		this.searchAndShow();
	}
	typing(ch: string) {
		this.show();
		this.quickPick.value += ch;
		this.onDidChangeValue();
	}
	typingNum(n: number) {
		this.Accept(this.quickPick.items[n]);
	}

	onDidChangeValue() {
		// window.showInformationMessage(`change: ${this.index}`);
		if (!this.quickPick.value) {
			this.quickPick.hide();
			return;
		}
		this.page = 0;
		this.searchAndShow();
	}
	async searchAndShow() {
		this.quickPick.busy = true;
		this.index += 1;
		const my_index = this.index;


		const item_count = (this.page + 1) * 8;
		const result = await this.cloudPinyin.search(this.quickPick.value, item_count);
		// window.showInformationMessage(`my page ${this.page}`);
		if (my_index < this.index_updated) {
			window.showInformationMessage(`ignore the result with index ${my_index}`);
			return;
		}
		this.index_updated = my_index;
		this.quickPick.items = result
			.slice(this.page * 8, (this.page + 1) * 8)
			.map((v, i) =>
				({ label: `${i}: ${v.hanzi}`, alwaysShow: true, result: v })
			);
		if (my_index === this.index) {
			this.quickPick.busy = false;
		}
	}

	Accept(item : MyQuickPickItem | null) {
		if (!item) {
			return;
		}
		editorInsert(item.result.hanzi);
		this.quickPick.value = this.quickPick.value.substr(item.result.matchedLength);
		this.onDidChangeValue();
	}

	onDidAccept() {
		this.Accept(this.quickPick.items[0]);
	}
	onDidHide() {
		this.quickPick.value = "";
		this.index_updated = this.index;
		vscode.commands.executeCommand("setContext", "extension.seleting", false);
	}
	hide() {
		this.quickPick.hide();
	}
}

const editorInsert = (text: string) => {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const position = editor.selections[0].anchor;
	editor.edit(editBuilder => {
		editBuilder.insert(
			position, text
		);
	});
};


// this method is called when your extension is deactivated
export function deactivate() {

}
