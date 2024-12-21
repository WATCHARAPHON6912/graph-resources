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
    }, 1000);
}

class GPUUsageViewProvider {
    static viewType = 'gpuUsageGraph';
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this.currentData = {
            gpu: [
                {
                    device: 'N/A',
                    gpuUsage: '0',
                    memoryUsage: '0',
                    memoryTotal: '0',
                    temperature: '0'
                }
            ],
            cpu: {
                cpuUsage: '0',
                memoryUsage: '0',
                memoryTotal: '0',
                temperature: '0',
            },
            drive: [{
                drive_name: "N/A",
                total_Size: "0",
                use_Size: "0"

            }
            ]
        };
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
            this._view.webview.postMessage({ command: 'update', data: usage });
        }
    }

    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'script.js'));
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));

        return `
<!DOCTYPE html>
<html lang="th">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Monitor</title>
    <link rel="stylesheet" href="${cssUri}">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
</head>

<body>
    <div class="header">
        <button class="container-menu" onclick="openPopup()">Menu</button>
    </div>

    <div class="container" id="chartContainer">
        <div class="chart-container">
            <canvas id="cpuRamChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="showTotalGpuVramGraph"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="gpuTotalChart"></canvas>
        </div>
    </div>

    <div class="overlay" id="overlay"></div>

    <div id="popupMenu" class="popup">
        <button class="popup-close" onclick="closePopup()">x</button>
        <div class="menu-title">Menu</div>

        <div id="drives-container" class="storage-section">
            <div class="storage-title">Storage Usage</div>
        </div>

        <div class="menu-list">
            <div class="menu-section">
                <div class="menu-item">
                    <input type="checkbox" id="showCpu">
                    <label for="showCpu">Show CPU usage</label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showSystemVram">
                    <label for="showSystemVram">Show device RAM usage</label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showGpus">
                    <label for="showGpus">Shows GPUs usage</label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showGpuVram">
                    <label for="showGpuVram">Shows VRAM GPUs usage</label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showCpuRamGraph">
                    <label for="showCpuRamGraph">Shows CPU and RAM graphs.</label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showGpuVramGraph">
                    <label for="showGpuVramGraph">Shows
                        <input type="number" id="gpuNValue" min=1 max=10000 value="1">
                        graphs of GPUs and VRAMs.
                    </label>
                </div>
                <div class="menu-item">
                    <input type="checkbox" id="showTotalGpu">
                    <label for="showTotalGpu">Shows graph of total GPUs and VRAMs.</label>
                </div>
                <div class="menu-item">
                    <label>
                        Graph height
                        <input type="number" id="chartHight" min="1" max="1000" value="200">
                    </label>
                </div>
                <div class="menu-item">
                    <label>
                        time
                        <input type="number" id="time" min="1" max="90" value="30"> s
                    </label>
                </div>

            </div>
        </div>

    </div>

    <script src="${scriptUri}"></script>

</body>

</html>

`;
    }
    _getGPUUsage() {
        const platform = process.platform;
        let nvidiaCommand, cpuCommand, ramCommand, driveCommand, netCommand;
        if (platform === 'win32') {
            //     nvidiaCommand = "nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits && \
            // nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = 'wmic cpu get loadpercentage /value';
            ramCommand = 'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value';
            driveCommand = "wmic logicaldisk get Caption, Size, FreeSpace /format:csv";
            netCommand = "netstat -e"
        } else if (platform === 'linux') {
            nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
            cpuCommand = "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'";
            ramCommand = "free -m | awk '/Mem:/ {printf \"%d\\n%d\", $3, $2}'";
            driveCommand = "df -B1 | awk 'NR==1 {print \"Filesystem,Size,Used,Available,Use%,Mounted_on\"} NR>1 {print $1\",\"$2\",\"$3\",\"$4\",\"$5\",\"$6}'";

            netCommand = "netstat -e"
        } else {
            console.error('Unsupported OS');
            return;
        }

        exec(nvidiaCommand, (error, stdout, stderr) => {
            if (error) {
                // console.error(`Error executing nvidia-smi: ${stderr}`);
            } else {
                const lines = stdout.trim().split('\n');
                if (lines.length > 0) {
                    this.currentData.gpu = []
                    for (let i = 0; i < lines.length; i++) {
                        // print(lines[i].split(', '));
                        const [device, usage, memoryUsed, memoryTotal, temperature] = lines[i].replace("\r", "").split(', ');
                        this.currentData.gpu.push({
                            device: device,
                            gpuUsage: `${usage}`,
                            memoryUsage: `${(memoryUsed / 1024).toFixed(2)}`,
                            memoryTotal: `${(memoryTotal / 1024).toFixed(2)}`,
                            temperature: `${temperature}`
                        })
                    }
                }
            }

        });


        exec(cpuCommand, (error, stdout, stderr) => {
            if (platform === 'win32') {
                if (error) {
                    // console.error(`Error executing CPU command: ${stderr}`);
                } else {
                    this.currentData.cpu.cpuUsage = `${stdout.trim().split('=')[1]}`;
                }
            }
            else {
                this.currentData.cpu.cpuUsage = stdout.trim();
            }

            exec(ramCommand, (error, stdout, stderr) => {
                if (platform === 'win32') {
                    if (error) {
                        // console.error(`Error executing RAM command: ${stderr}`);
                    } else {
                        var x = stdout.trim().split('\n');
                        var free = x[0].split('=')[1];
                        var total = x[1].split('=')[1]
                        this.currentData.cpu.memoryUsage = `${((total - free) / (1024 * 1024)).toFixed(2)}`;
                        this.currentData.cpu.memoryTotal = `${(total / (1024 * 1024)).toFixed(2)}`;
                    }
                } else {
                    if (error) {
                        // console.error(`Error executing RAM command: ${stderr}`);
                        this.currentData.ramUsage = 'Error';
                    } else {
                        var x = stdout.trim().split('\n');
                        var total = x[1];
                        var used = x[0];
                        this.currentData.cpu.memoryUsage = `${(used / (1024)).toFixed(2)}`;
                        this.currentData.cpu.memoryTotal = `${(total / (1024)).toFixed(2)}`;
                    }
                }
            });
        });


        exec(driveCommand, (error, stdout, stderr) => {

            if (error) {
                console.error(`Error executing driveCommand: ${stderr}`);

            } else {
                if (platform === 'win32') {
                    const lines = stdout.trim().split('\n');
                    if (lines.length > 0) {
                        this.currentData.drive = []
                        for (let i = 1; i < lines.length; i++) {
                            const [Node, Caption, FreeSpace, Size] = lines[i].replace("\r", "").split(',')
                            this.currentData.drive.push({
                                drive_name: Caption,
                                total_Size: `${((Size) / (1024 * 1024 * 1024)).toFixed(2)}`,
                                use_Size: `${((Size - FreeSpace) / (1024 * 1024 * 1024)).toFixed(2)}`

                            })
                        }
                    }
                }
                else {
                    const lines = stdout.trim().split('\n');
                    if (lines.length > 0) {
                        this.currentData.drive = []
                        for (let i = 1; i < lines.length; i++) {
                            const [Filesystem,Size,Used,Available,Use_percen,Mounted_on] = lines[i].replace("\r", "").split(',')
                            this.currentData.drive.push({
                                drive_name: Mounted_on,
                                total_Size: `${((Size) / (1024 * 1024 * 1024)).toFixed(2)}`,
                                use_Size: `${((Used) / (1024 * 1024 * 1024)).toFixed(2)}`

                            })
                        }
                    }
                }


            }


        });

        // console.log(this.currentData)



        // this.currentData.gpu[0].device="test gpu"
        // this.currentData.gpu[0].memoryTotal="10"
        // this.currentData.gpu[0].memoryUsage="5"
        // this.currentData.gpu[0].gpuUsage="55"
        // this.currentData.drive = []
        // this.currentData.drive.push({
        //     drive_name: "ntest1",
        //     total_Size: `${100}`,
        //     use_Size: `${50}`

        // })

        return this.currentData;
    }

}

module.exports = {
    activate
};

