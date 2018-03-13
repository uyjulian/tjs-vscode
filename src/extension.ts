'use strict';
import { ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
const exec = require('child_process').exec;

type CtagsProcess = {
    tagFilePath: string;
    searchPath: string;
    searchRecursive: boolean;
    runOnSave: boolean;
    fileExtensions: string[];
    extraOption: string;
    [index: string]: string | boolean | string[];
};

class CTagsSupportProvider {
    private process: CtagsProcess[] = [];
    private readonly defaultProcess: CtagsProcess = {
        "tagFilePath": ".tags",
        "searchPath": "",
        "searchRecursive": true,
        "runOnSave": false,
        "fileExtensions": [
            ".tjs"
        ],
        "extraOption": ""
    };
    private readonly processKeys: string[] = [];

    public constructor() {
        for (const key in this.defaultProcess) {
            if (this.defaultProcess.hasOwnProperty(key)) {
                this.processKeys.push(key);
            }
        }
        this.loadConfiguration();
    }

    private loadConfiguration() {
        this.process = vscode.workspace.getConfiguration("tjs").ctagsProcess;
        if (this.process === undefined) {
            this.process = [this.defaultProcess];
        } else {
            const toString = Object.prototype.toString;
            this.process.forEach((p, index) => {
                this.processKeys.forEach(key => {
                    if (p[key] === undefined) {
                        p[key] = this.defaultProcess[key];
                    } else if (toString.call(p[key]) !== toString.call(this.defaultProcess[key])) {
                        vscode.window.showErrorMessage(`tjs.ctagsProcess[${index}].${key} has wrong value.`);
                        p[key] = this.defaultProcess[key];
                    }
                });
            });
        }
    }

    public updateCtags(save: boolean = false) {
        const rootPath = vscode.workspace.rootPath;
        if (rootPath === undefined) {
            vscode.window.showErrorMessage("No project currently opened");
            return;
        }

        for (let index = 0; index < this.process.length; index++) {
            const p = this.process[index];
            if (save && !p.runOnSave) { continue; }
            if (p.tagFilePath === "") {
                vscode.window.showErrorMessage(`tjs.ctagsProcess[${index}].tagFilePath is empty.`);
                continue;
            }
            if (p.fileExtensions.length === 0) {
                vscode.window.showErrorMessage(`tjs.ctagsProcess[${index}].fileExtensions is empty.`);
                continue;
            }
            let langmap: string = p.fileExtensions.join(",");
            let cmd: string = "ctags" +
                " --langdef=tjs" +
                ` --langmap=tjs:${langmap}` +
                " --regex-tjs=\"/^[ \\t]*class[ \\t]+([a-zA-Z0-9_]+)/\\1/c,class/\"" +
                " --regex-tjs=\"/^[ \\t]*function[ \\t]+([a-zA-Z0-9_]+)/\\1/f,function/\"" +
                " --regex-tjs=\"/^[ \\t]*property[ \\t]+([a-zA-Z0-9_]+)/\\1/p,property/\"" +
                " --regex-tjs=\"/^[ \\t]*var[ \\t]+([a-zA-Z0-9_]+)/\\1/v,value/\"" +
                " --regex-tjs=\"/^[ \\t]*const[ \\t]+([a-zA-Z0-9_]+)/\\1/v,value/\"" +
                " --regex-tjs=\"/^[ \\t]*([a-zA-Z0-9_]+)[ \\t]*:[ \\t]*function/\\1/f,function/\"" +
                " --regex-tjs=\"/([a-zA-Z0-9_]+)[ \\t]*=[ \\t]*function/\\1/f,function/\"" +
                ` ${p.extraOption} -f \"${rootPath}\\${p.tagFilePath}\" ${p.searchRecursive ? "-R" : ""} \"${rootPath}\\${p.searchPath}*\"`;
            exec(cmd,
                (err: any, stdout: any, stderr: any) => {
                    if (err !== null) {
                        vscode.window.showErrorMessage("ctags:" + err);
                    }
                });
        }
    }

    public onDidSaveTextDocument(document: vscode.TextDocument) {
        if (document.languageId === "tjs") {
            this.updateCtags(true);
        }
    }

    public onDidChangeConfiguration() {
        this.loadConfiguration();
    }
}

export function activate(ctx: ExtensionContext): void {
    const ctagsSupportProvider = new CTagsSupportProvider();
    ctx.subscriptions.push(vscode.commands.registerCommand("tjs.updateCtags", () => {
        ctagsSupportProvider.updateCtags();
    }));
    ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        ctagsSupportProvider.onDidSaveTextDocument(document);
    }));
    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        ctagsSupportProvider.onDidChangeConfiguration();
    }));
}
