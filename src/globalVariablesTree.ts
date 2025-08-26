import * as vscode from 'vscode';
import { ext } from './extensionVariables';
import { GlobalVariable } from './globalVariablesJack';

export class GlobalVariableTreeItem extends vscode.TreeItem {
    constructor(
        public readonly globalVariable: GlobalVariable,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(globalVariable.name, collapsibleState);
        this.tooltip = `${this.globalVariable.name}: ${this.globalVariable.value}`;
        this.description = this.globalVariable.value.length > 50 
            ? this.globalVariable.value.substring(0, 47) + '...' 
            : this.globalVariable.value;
        this.contextValue = 'globalVariable';

        // Иконка для переменной
        this.iconPath = new vscode.ThemeIcon('symbol-variable');
    }
}

export class GlobalVariablesTree implements vscode.TreeDataProvider<GlobalVariableTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GlobalVariableTreeItem | undefined | null | void> = new vscode.EventEmitter<GlobalVariableTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GlobalVariableTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private globalVariables: GlobalVariable[] = [];

    constructor() {
        // Регистрируем TreeView
        const treeView = vscode.window.createTreeView('globalVariablesTree', {
            treeDataProvider: this,
            showCollapseAll: false
        });

        ext.context.subscriptions.push(treeView);

        // Команды для контекстного меню
        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.refresh', () => {
            this.refresh();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.copy', (item: GlobalVariableTreeItem) => {
            vscode.env.clipboard.writeText(item.globalVariable.value);
            vscode.window.showInformationMessage(`Значение переменной '${item.globalVariable.name}' скопировано в буфер обмена`);
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.copyName', (item: GlobalVariableTreeItem) => {
            vscode.env.clipboard.writeText(item.globalVariable.name);
            vscode.window.showInformationMessage(`Имя переменной '${item.globalVariable.name}' скопировано в буфер обмена`);
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.copyUsage', (item: GlobalVariableTreeItem) => {
            const usage = `env.${item.globalVariable.name}`;
            vscode.env.clipboard.writeText(usage);
            vscode.window.showInformationMessage(`Использование переменной '${usage}' скопировано в буфер обмена`);
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.edit', (item: GlobalVariableTreeItem) => {
            this.editVariable(item.globalVariable);
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.tree.globalVariables.delete', (item: GlobalVariableTreeItem) => {
            this.deleteVariable(item.globalVariable);
        }));

        // Автообновление при активации соединения
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('jenkins-jack.jenkins.connections')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GlobalVariableTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GlobalVariableTreeItem): Promise<GlobalVariableTreeItem[]> {
        if (!ext.connectionsManager.activeConnection) {
            return [];
        }

        if (!element) {
            // Корневые элементы - список глобальных переменных
            try {
                this.globalVariables = await ext.globalVariablesJack.getGlobalVariables();
                return this.globalVariables.map(globalVar => new GlobalVariableTreeItem(globalVar));
            } catch (error) {
                ext.logger.error(`Error loading global variables: ${error}`);
                return [];
            }
        }

        return [];
    }

    private async editVariable(globalVariable: GlobalVariable) {
        const newValue = await vscode.window.showInputBox({
            prompt: `Введите новое значение для '${globalVariable.name}'`,
            value: globalVariable.value
        });

        if (newValue === undefined) return;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Обновление глобальной переменной...',
                cancellable: false
            }, async () => {
                await ext.globalVariablesJack.setGlobalVariable(globalVariable.name, newValue, '');
            });

            vscode.window.showInformationMessage(`Глобальная переменная '${globalVariable.name}' обновлена успешно.`);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при обновлении переменной: ${error}`);
        }
    }

    private async deleteVariable(globalVariable: GlobalVariable) {
        const confirmation = await vscode.window.showWarningMessage(
            `Вы уверены, что хотите удалить переменную '${globalVariable.name}'?`,
            { modal: true },
            'Удалить'
        );

        if (confirmation !== 'Удалить') return;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Удаление глобальной переменной...',
                cancellable: false
            }, async () => {
                await ext.globalVariablesJack.deleteGlobalVariableByName(globalVariable.name);
            });

            vscode.window.showInformationMessage(`Глобальная переменная '${globalVariable.name}' удалена успешно.`);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при удалении переменной: ${error}`);
        }
    }
}
