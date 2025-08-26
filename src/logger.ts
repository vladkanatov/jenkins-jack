import * as vscode from 'vscode';
import * as dayjs from 'dayjs';

export class Logger {
    private _outputChannel: vscode.OutputChannel;
    private _level: Level;

    private readonly levelStringMap = [
        'trace',
        'debug',
        'info',
        'warning',
        'error'
    ]

    protected readonly barrierLine: string = '-'.repeat(80);

    constructor() {
        this._outputChannel = vscode.window.createOutputChannel("Jenkins Jack Log");

        // TODO: make this config driven
        this._level = Level.Info;
    }

    public trace(message: any) {
        if (this._level > Level.Trace) { return; }
        this.out(Level.Trace, message);
    }

    public debug(message: any) {
        if (this._level > Level.Debug) { return; }
        this.out(Level.Debug, message);
    }

    public info(message: any) {
        if (this._level > Level.Info) { return; }
        this.out(Level.Info, message);
    }

    public warn(message: any) {
        if (this._level > Level.Warning) { return; }
        this.out(Level.Warning, message);
    }

    public error(message: any) {
        if (this._level > Level.Error) { return; }
        this.out(Level.Error, message);
    }

    private out(level: Level, message: any) {

        let caller = 'jenkins-jack'
        try { throw new Error(); }
        catch (e) {
            let ex = e as any;
            // HACK: parses the call-stack for a specific line to grab the calling module
            if (ex.stack) {
                const stackLines = ex.stack.split('\n');
                if (stackLines.length > 3) {
                    const match = stackLines[3].match(/.*[\/|\\](.*)\.js.*/);
                    if (match && match[1]) {
                        caller = match[1];
                    }
                }
            }
        }
        let logLine = `[${dayjs().format('DD-MM-YYYY HH:mm:ss')}] [${caller}] [${this.levelStringMap[level]}] - ${message}`;

        this._outputChannel.appendLine(logLine);
        console.log(logLine);
    }
}

export enum Level {
    Trace = 0,
    Debug,
    Info,
    Warning,
    Error,
    Failure
}
