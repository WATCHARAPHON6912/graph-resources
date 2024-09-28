const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function activate(context) {
    const provider = new GPUUsageViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GPUUsageViewProvider.viewType, provider)
    );

    setInterval(() => {
        provider.update();
    }, 500);
}

class GPUUsageViewProvider {
    static viewType = 'gpuUsageGraph';
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this.currentData = {};
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        this._dataPoints = [];
    }

    update() {
        if (this._view) {
            const usage = this._getGPUUsage();
            this._dataPoints.push(usage);
            if (this._dataPoints.length > 60) {
                this._dataPoints.shift();
            }
            this._view.webview.postMessage({ command: 'update', data: this._dataPoints });
        }
    }

    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        return `<!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>GPU Usage Graph</title>
                <style>
                    body { padding: 0; margin: 0; }
                    canvas { width: 100%; height: 100%; }
                </style>
            </head>
            <body>
                <canvas id="gpuUsageChart"></canvas>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    _getGPUUsage() {
        // This is a mock function. In a real scenario, you'd need to use a library or system call to get actual GPU usage.
        // return Math.floor(Math.random() * 50);
        const platform = process.platform;
        let nvidiaCommand, cpuCommand, ramCommand;

        if (platform === 'win32') {
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = 'wmic cpu get loadpercentage /value';
            ramCommand = 'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value';
        } else if (platform === 'linux') {
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = 'top -bn1 | grep "Cpu(s)" | awk \'{print $2 + $4}\'';
            ramCommand = "free -m | awk '/Mem:/ {printf \"%.1f \\n%.1f \\n\", $2, $3}'";
        } else {
            console.error('Unsupported OS');
            return;
        }

        exec(nvidiaCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing nvidia-smi: ${stderr}`);
                this.currentData.device = 'Error';
                this.currentData.GpuUsage = 'Error';
                this.currentData.memoryUsage = 'Error';
                this.currentData.temperature = 'Error';
            } else {
                const lines = stdout.trim().split('\n');
                if (lines.length > 0) {
                    const [device, usage, memoryUsed, memoryTotal, temperature] = lines[0].split(', ');
                    this.currentData.device = `${device}`;
                    this.currentData.GpuUsage = `${usage}`;
                    this.currentData.memoryUsage = `${(memoryUsed/ 1024).toFixed(2)}`;
                    this.currentData.memoryTotal = `${(memoryTotal/ 1024).toFixed(2)}`;
                    this.currentData.temperature = `${temperature}°C`;
                } else {
                    this.currentData.device = 'N/A';
                    this.currentData.GpuUsage = 'N/A';
                    this.currentData.memoryUsage = 'N/A';
                    this.currentData.temperature = 'N/A';
                }
            }

            exec(cpuCommand, (error, stdout, stderr) => {
                if(platform === 'win32'){
                    if (error) {
                        console.error(`Error executing CPU command: ${stderr}`);
                        this.currentData.cpuUsage = 'Error';
                    } else {
                        this.currentData.cpuUsage = `${stdout.trim().split('=')[1]}`;
                    }
                }
                else{
                    this.currentData.cpuUsage = stdout.trim();
                }

            exec(ramCommand, (error, stdout, stderr) => {
                if(platform === 'win32'){
                    if (error) {
                        console.error(`Error executing RAM command: ${stderr}`);
                        this.currentData.ramUsage = 'Error';
                    } else {
                        var x=stdout.trim().split('\n');
                        var free=x[0].split('=')[1];
                        var total=x[1].split('=')[1]
                        this.currentData.ramUsed = `${((total-free)/ (1024 * 1024)).toFixed(2)}`;
                        this.currentData.ramTotal = `${(total/ (1024 * 1024)).toFixed(2)}`;
                    }
                }else{
                    if (error) {
                        console.error(`Error executing RAM command: ${stderr}`);
                        this.currentData.ramUsage = 'Error';
                    } else {
                        var x=stdout.trim().split('\n');
                        var total=x[0];
                        var used=x[1];
                        this.currentData.ramUsed = `${(used/ (1024)).toFixed(2)}`;
                        this.currentData.ramTotal= `${(total/ (1024)).toFixed(2)}`;
                    }
                }
                this._onDidChangeTreeData.fire(); // อัปเดต tree view
                });
            });
        });

        return [
            [this.currentData.memoryUsage,this.currentData.memoryTotal],
            [this.currentData.GpuUsage,100]
            // [this.currentData.device,0]
            // [this.currentData.ramUsed ,this.currentData.ramTotal],
            // [this.currentData.cpuUsage,100]
        ];
        // return [4,100];
    }
}

module.exports = {
    activate
};

