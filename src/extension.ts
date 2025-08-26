import * as vscode from 'vscode';
import { PipelineJack } from './pipelineJack';
import { PipelineSnippets } from './snippets';
import { ScriptConsoleJack } from './scriptConsoleJack';
import { BuildJack } from './buildJack';
import { ConnectionsManager } from './connectionsManager';
import { NodeJack } from './nodeJack';
import { JobJack } from './jobJack';
import { OutputPanelProvider } from './outputProvider';
import { QuickpickSet } from './quickpickSet';
import { PipelineTree } from './pipelineTree';
import { JobTree } from './jobTree';
import { NodeTree } from './nodeTree';
import { ext } from './extensionVariables';
import { applyBackwardsCompat } from './utils';
import { ConnectionsTree } from './connectionsTree';
import { Logger } from './logger';
import { QueueJack } from './queueJack';
import { QueueTree } from './queueTree';
import { GlobalVariablesJack } from './globalVariablesJack';
import { GlobalVariablesTree } from './globalVariablesTree';

export async function activate(context: vscode.ExtensionContext) {

    await applyBackwardsCompat();

    ext.context = context;

    ext.logger = new Logger();

    // We initialize the Jenkins service first in order to avoid
    // a race condition during onDidChangeConfiguration
    let commandSets: QuickpickSet[] = [];
    ext.connectionsManager = new ConnectionsManager();
    await ext.connectionsManager.initialize();

    ext.pipelineSnippets = new PipelineSnippets();

    // Initialize the output panel provider for jack command output
    ext.outputPanelProvider = new OutputPanelProvider();

    // Initialize top level jacks and gather their sub-commands for the Jack command
    // quick-pick display
    ext.pipelineJack = new PipelineJack();
    commandSets.push(ext.pipelineJack);

    ext.scriptConsoleJack = new ScriptConsoleJack();
    commandSets.push(ext.scriptConsoleJack);

    ext.jobJack = new JobJack();
    commandSets.push(ext.jobJack);

    ext.buildJack = new BuildJack();
    commandSets.push(ext.buildJack);

    ext.nodeJack = new NodeJack();
    commandSets.push(ext.nodeJack);

    ext.queueJack = new QueueJack();
    commandSets.push(ext.queueJack);

    ext.globalVariablesJack = new GlobalVariablesJack();
    commandSets.push(ext.globalVariablesJack);

    commandSets.push(ext.connectionsManager);

    ext.logger.info('Extension Jenkins Jack now active!');

    ext.context.subscriptions.push(vscode.commands.registerCommand('extension.jenkins-jack.jacks', async () => {

        // Build up quick pick list
        let selections: any[] = [];
        for (let c of commandSets) {
            let cmds = c.commands;
            if (0 === cmds.length) { continue; }
            selections = selections.concat(cmds);
            // visual label to divide up the jack sub commands
            selections.push({label: '$(kebab-horizontal)', description: ''});
        }
        // Remove last divider
        selections.pop();

        // Display full list of all commands and execute selected target.
        let result = await vscode.window.showQuickPick(selections);
        if (undefined === result || undefined === result.target) { return; }
        await result.target();
	}));

    // Initialize tree views
    ext.connectionsTree = new ConnectionsTree();
    ext.pipelineTree = new PipelineTree();
    ext.jobTree = new JobTree();
    ext.queueTree = new QueueTree();
    ext.nodeTree = new NodeTree();
    ext.globalVariablesTree = new GlobalVariablesTree();
}

export function deactivate() {}
