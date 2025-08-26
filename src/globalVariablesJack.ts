import * as vscode from 'vscode';
import { JackBase } from './jack';
import { ext } from './extensionVariables';

export interface GlobalVariable {
    name: string;
    value: string;
    description?: string;
}

export class GlobalVariablesJack extends JackBase {
    constructor() {
        super('Global Variables', 'extension.jenkins-jack.globalVariables');

        // Register all global variables commands
        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.list', async () => {
            await this.listGlobalVariables();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.create', async () => {
            await this.createGlobalVariable();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.update', async () => {
            await this.updateGlobalVariable();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.delete', async () => {
            await this.deleteGlobalVariable();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.export', async () => {
            await this.exportGlobalVariables();
        }));

        ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.globalVariables.import', async () => {
            await this.importGlobalVariables();
        }));
    }

    public get commands(): any[] {
        return [
            {
                label: "$(list-unordered)  Global Variables: List",
                description: "Отображает все глобальные переменные Jenkins.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.list')
            },
            {
                label: "$(plus)  Global Variables: Create",
                description: "Создает новую глобальную переменную.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.create')
            },
            {
                label: "$(edit)  Global Variables: Update",
                description: "Обновляет существующую глобальную переменную.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.update')
            },
            {
                label: "$(trash)  Global Variables: Delete",
                description: "Удаляет глобальную переменную.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.delete')
            },
            {
                label: "$(export)  Global Variables: Export",
                description: "Экспортирует глобальные переменные в файл JSON.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.export')
            },
            {
                label: "$(import)  Global Variables: Import",
                description: "Импортирует глобальные переменные из файла JSON.",
                target: () => vscode.commands.executeCommand('extension.jenkins-jack.globalVariables.import')
            }
        ];
    }

    /**
     * Получает список всех глобальных переменных через Jenkins API
     */
    public async getGlobalVariables(): Promise<GlobalVariable[]> {
        try {
            // Используем Jenkins Script Console API для получения глобальных переменных
            const script = `
                import jenkins.model.Jenkins
                import hudson.slaves.EnvironmentVariablesNodeProperty
                import groovy.json.JsonBuilder
                
                def globalVars = []
                def jenkins = Jenkins.instance
                def globalNodeProperties = jenkins.getGlobalNodeProperties()
                
                // Получаем переменные окружения из глобальных свойств узлов
                def envVarsNodePropertyList = globalNodeProperties.getAll(EnvironmentVariablesNodeProperty.class)
                
                if (envVarsNodePropertyList != null && envVarsNodePropertyList.size() > 0) {
                    def envVars = envVarsNodePropertyList.get(0).getEnvVars()
                    envVars.each { key, value ->
                        globalVars.add([name: key, value: value, description: "Environment variable"])
                    }
                } else {
                    // Если нет переменных, создаем пример для демонстрации
                    globalVars.add([name: "EXAMPLE_VAR", value: "example_value", description: "Example global variable"])
                }
                
                // Выводим только JSON без префиксов
                def json = new JsonBuilder(globalVars)
                print json.toString()
            `;

            const response = await this.executeScript(script);
            ext.logger.info(`Raw Jenkins script response: ${response}`);
            
            if (!response || response.trim() === '') {
                ext.logger.warn('Empty response from Jenkins script');
                return [];
            }
            
            // Убираем возможные префиксы и суффиксы
            let cleanResponse = response.trim();
            
            // Убираем префикс "Result: " если есть
            if (cleanResponse.startsWith('Result: ')) {
                cleanResponse = cleanResponse.substring(8).trim();
            }
            
            // Ищем JSON в ответе (может быть между другими строками)
            const jsonMatch = cleanResponse.match(/\[.*\]/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }
            
            try {
                const parsed = JSON.parse(cleanResponse);
                ext.logger.info(`Successfully parsed ${parsed.length} global variables from Jenkins`);
                return parsed || [];
            } catch (parseError) {
                ext.logger.error(`Failed to parse JSON response: ${parseError}`);
                ext.logger.error(`Clean response: ${cleanResponse}`);
                return [];
            }
        } catch (error) {
            ext.logger.error(`Error getting global variables: ${error}`);
            return [];
        }
    }

    /**
     * Отображает список всех глобальных переменных
     */
    private async listGlobalVariables() {
        const globalVars = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'Получение глобальных переменных...',
            cancellable: true
        }, async (progress) => {
            return await this.getGlobalVariables();
        });

        if (globalVars.length === 0) {
            vscode.window.showInformationMessage('Глобальные переменные не найдены.');
            return;
        }

        this.outputChannel.clear();
        this.outputChannel.appendLine('=== JENKINS GLOBAL VARIABLES ===\n');
        
        globalVars.forEach((globalVar, index) => {
            this.outputChannel.appendLine(`${index + 1}. ${globalVar.name}`);
            this.outputChannel.appendLine(`   Value: ${globalVar.value}`);
            if (globalVar.description) {
                this.outputChannel.appendLine(`   Description: ${globalVar.description}`);
            }
            this.outputChannel.appendLine('');
        });

        this.outputChannel.show();

        // Также показываем быстрый выбор для детального просмотра
        const quickPickItems = globalVars.map(globalVar => ({
            label: globalVar.name,
            description: globalVar.value,
            detail: globalVar.description,
            globalVar
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Выберите переменную для детального просмотра',
            ignoreFocusOut: true
        });

        if (selected) {
            await this.showVariableDetails(selected.globalVar);
        }
    }

    /**
     * Создает новую глобальную переменную
     */
    private async createGlobalVariable() {
        const name = await vscode.window.showInputBox({
            prompt: 'Введите имя глобальной переменной',
            placeHolder: 'MY_GLOBAL_VAR',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Имя переменной не может быть пустым';
                }
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.trim())) {
                    return 'Имя переменной может содержать только буквы, цифры и подчеркивания';
                }
                return null;
            }
        });

        if (!name) return;

        const value = await vscode.window.showInputBox({
            prompt: 'Введите значение переменной',
            placeHolder: 'Значение переменной'
        });

        if (value === undefined) return;

        const description = await vscode.window.showInputBox({
            prompt: 'Введите описание переменной (необязательно)',
            placeHolder: 'Описание переменной'
        });

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Создание глобальной переменной...',
                cancellable: false
            }, async () => {
                await this.setGlobalVariable(name.trim(), value, description || '');
            });

            vscode.window.showInformationMessage(`Глобальная переменная '${name}' создана успешно.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при создании переменной: ${error}`);
        }
    }

    /**
     * Обновляет существующую глобальную переменную
     */
    private async updateGlobalVariable() {
        const globalVars = await this.getGlobalVariables();
        
        if (globalVars.length === 0) {
            vscode.window.showInformationMessage('Глобальные переменные не найдены.');
            return;
        }

        const quickPickItems = globalVars.map(globalVar => ({
            label: globalVar.name,
            description: globalVar.value,
            detail: globalVar.description,
            globalVar
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Выберите переменную для обновления',
            ignoreFocusOut: true
        });

        if (!selected) return;

        const newValue = await vscode.window.showInputBox({
            prompt: `Введите новое значение для '${selected.globalVar.name}'`,
            value: selected.globalVar.value
        });

        if (newValue === undefined) return;

        const newDescription = await vscode.window.showInputBox({
            prompt: 'Введите новое описание (необязательно)',
            value: selected.globalVar.description || ''
        });

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Обновление глобальной переменной...',
                cancellable: false
            }, async () => {
                await this.setGlobalVariable(selected.globalVar.name, newValue, newDescription || '');
            });

            vscode.window.showInformationMessage(`Глобальная переменная '${selected.globalVar.name}' обновлена успешно.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при обновлении переменной: ${error}`);
        }
    }

    /**
     * Удаляет глобальную переменную
     */
    private async deleteGlobalVariable() {
        const globalVars = await this.getGlobalVariables();
        
        if (globalVars.length === 0) {
            vscode.window.showInformationMessage('Глобальные переменные не найдены.');
            return;
        }

        const quickPickItems = globalVars.map(globalVar => ({
            label: globalVar.name,
            description: globalVar.value,
            detail: globalVar.description,
            globalVar
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Выберите переменную для удаления',
            ignoreFocusOut: true
        });

        if (!selected) return;

        const confirmation = await vscode.window.showWarningMessage(
            `Вы уверены, что хотите удалить переменную '${selected.globalVar.name}'?`,
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
                await this.deleteGlobalVariableByName(selected.globalVar.name);
            });

            vscode.window.showInformationMessage(`Глобальная переменная '${selected.globalVar.name}' удалена успешно.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при удалении переменной: ${error}`);
        }
    }

    /**
     * Экспортирует глобальные переменные в JSON файл
     */
    private async exportGlobalVariables() {
        const globalVars = await this.getGlobalVariables();
        
        if (globalVars.length === 0) {
            vscode.window.showInformationMessage('Глобальные переменные не найдены.');
            return;
        }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('jenkins-global-variables.json'),
            filters: {
                'JSON': ['json']
            }
        });

        if (!uri) return;

        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                jenkinsHost: ext.connectionsManager.activeConnection?.name || 'unknown',
                variables: globalVars
            };

            const content = JSON.stringify(exportData, null, 2);
            const uint8Array = new Uint8Array(Buffer.from(content, 'utf8'));
            await vscode.workspace.fs.writeFile(uri, uint8Array);

            vscode.window.showInformationMessage(`Глобальные переменные экспортированы в ${uri.fsPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при экспорте: ${error}`);
        }
    }

    /**
     * Импортирует глобальные переменные из JSON файла
     */
    private async importGlobalVariables() {
        const uri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'JSON': ['json']
            }
        });

        if (!uri || uri.length === 0) return;

        try {
            const fileContent = await vscode.workspace.fs.readFile(uri[0]);
            const importData = JSON.parse(fileContent.toString());

            if (!importData.variables || !Array.isArray(importData.variables)) {
                vscode.window.showErrorMessage('Неверный формат файла. Ожидается массив переменных в поле "variables".');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `Импортировать ${importData.variables.length} переменных? Это может перезаписать существующие переменные.`,
                { modal: true },
                'Импортировать'
            );

            if (confirmation !== 'Импортировать') return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Импорт глобальных переменных...',
                cancellable: false
            }, async (progress) => {
                for (let i = 0; i < importData.variables.length; i++) {
                    const variable = importData.variables[i];
                    progress.report({
                        message: `Импорт ${variable.name} (${i + 1}/${importData.variables.length})`,
                        increment: (100 / importData.variables.length)
                    });
                    
                    await this.setGlobalVariable(
                        variable.name,
                        variable.value,
                        variable.description || ''
                    );
                }
            });

            vscode.window.showInformationMessage(`Импортировано ${importData.variables.length} глобальных переменных.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Ошибка при импорте: ${error}`);
        }
    }

    /**
     * Показывает детали переменной в webview
     */
    private async showVariableDetails(globalVar: GlobalVariable) {
        const panel = vscode.window.createWebviewPanel(
            'globalVariableDetails',
            `Global Variable: ${globalVar.name}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Global Variable Details</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 20px;
                        line-height: 1.6;
                    }
                    .header { border-bottom: 2px solid #007ACC; padding-bottom: 10px; margin-bottom: 20px; }
                    .name { font-size: 24px; font-weight: bold; color: #007ACC; }
                    .section { margin-bottom: 20px; }
                    .label { font-weight: bold; color: #666; }
                    .value { 
                        background: #f5f5f5; 
                        border-left: 4px solid #007ACC; 
                        padding: 10px; 
                        margin: 5px 0; 
                        font-family: 'Courier New', monospace;
                        white-space: pre-wrap;
                    }
                    .description { 
                        background: #f9f9f9; 
                        padding: 10px; 
                        border-radius: 4px; 
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="name">${globalVar.name}</div>
                </div>
                <div class="section">
                    <div class="label">Value:</div>
                    <div class="value">${this.escapeHtml(globalVar.value)}</div>
                </div>
                ${globalVar.description ? `
                <div class="section">
                    <div class="label">Description:</div>
                    <div class="description">${this.escapeHtml(globalVar.description)}</div>
                </div>
                ` : ''}
                <div class="section">
                    <div class="label">Usage in Pipeline:</div>
                    <div class="value">env.${globalVar.name}
// or
\${env.${globalVar.name}}</div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Устанавливает глобальную переменную через Jenkins Script Console
     */
    public async setGlobalVariable(name: string, value: string, description: string = '') {
        const script = `
            import jenkins.model.Jenkins
            import hudson.slaves.EnvironmentVariablesNodeProperty
            import hudson.slaves.EnvironmentVariablesNodeProperty.Entry
            
            def jenkins = Jenkins.instance
            def globalNodeProperties = jenkins.getGlobalNodeProperties()
            def envVarsNodePropertyList = globalNodeProperties.getAll(EnvironmentVariablesNodeProperty.class)
            
            def newEnvVarsNodeProperty = null
            def envVars = null
            
            if (envVarsNodePropertyList == null || envVarsNodePropertyList.size() == 0) {
                newEnvVarsNodeProperty = new EnvironmentVariablesNodeProperty()
                globalNodeProperties.add(newEnvVarsNodeProperty)
                envVars = newEnvVarsNodeProperty.getEnvVars()
            } else {
                envVars = envVarsNodePropertyList.get(0).getEnvVars()
            }
            
            envVars.put("${name.replace('"', '\\"')}", "${value.replace('"', '\\"')}")
            jenkins.save()
            
            return "Variable '${name.replace('"', '\\"')}' set successfully"
        `;

        return await this.executeScript(script);
    }

    /**
     * Удаляет глобальную переменную по имени
     */
    public async deleteGlobalVariableByName(name: string) {
        const script = `
            import jenkins.model.Jenkins
            import hudson.slaves.EnvironmentVariablesNodeProperty
            
            def jenkins = Jenkins.instance
            def globalNodeProperties = jenkins.getGlobalNodeProperties()
            def envVarsNodePropertyList = globalNodeProperties.getAll(EnvironmentVariablesNodeProperty.class)
            
            if (envVarsNodePropertyList != null && envVarsNodePropertyList.size() > 0) {
                def envVars = envVarsNodePropertyList.get(0).getEnvVars()
                def removed = envVars.remove("${name.replace('"', '\\"')}")
                if (removed != null) {
                    jenkins.save()
                    return "Variable '${name.replace('"', '\\"')}' deleted successfully"
                } else {
                    return "Variable '${name.replace('"', '\\"')}' not found"
                }
            }
            
            return "Variable '${name.replace('"', '\\"')}' not found - no environment variables configured"
        `;

        return await this.executeScript(script);
    }

    /**
     * Выполняет Groovy script через Jenkins Script Console
     */
    private async executeScript(script: string): Promise<string> {
        try {
            return await ext.connectionsManager.host.runConsoleScript(script);
        } catch (error) {
            ext.logger.error(`Error executing script: ${error}`);
            throw error;
        }
    }

    /**
     * Экранирует HTML символы
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
