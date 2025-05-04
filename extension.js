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
                cpuName: 'N/A',
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
            <!--
                <div class="menu-item">
                    <input type="checkbox" id="showCPUTemp">
                    <label for="showCpu">Show CPU Temperature</label>
                </div>
            -->
                <div class="menu-item">
                    <input type="checkbox" id="showTemp">
                    <label for="showCpu">Show GPU Temperature</label>
                </div>
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
                        <input type="number" id="gpuNValue" min=0 max=10000 value=0>
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
        // nvidiaCommand = "nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits && \
            // nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"
        nvidiaCommand = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits';
        
        if (platform === 'win32') {
            cpuCommand = `powershell -Command "$cpu=Get-CimInstance Win32_Processor; $os=Get-CimInstance Win32_OperatingSystem; $drives=Get-CimInstance Win32_LogicalDisk; $usedMem=[int]$os.TotalVisibleMemorySize - [int]$os.FreePhysicalMemory; Write-Output \\"cpu,$($cpu.Name) ,$($cpu.LoadPercentage)\\"; Write-Output \\"ram,$usedMem ,$($os.TotalVisibleMemorySize)\\"; $drives | ForEach-Object { Write-Output \\"drive,$($_.DeviceID) ,$($_.FreeSpace) ,$($_.Size)\\" }"`;

        } else if (platform === 'linux') {
            cpuCommand = `
echo -n "cpu,"; lscpu | awk -F: '/Model name/ {gsub(/^ +| +$/, "", $2); printf "%s ,", $2}'; 
top -bn1 | grep "Cpu(s)" | awk '{print int($2)}'; 
echo -n "ram,"; free -k | awk '/Mem:/ {used=$2-$7; printf "%d ,%d\\n", used, $2}'; 
df -k --output=target,used,size | tail -n +2 | awk '{printf "drive,%s ,%d ,%d\\n", $1, $2*1024, $3*1024}'
`;
            // netCommand = "netstat -e"
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

            if (error) {
                // console.error(`Error executing CPU command: ${stderr}`);
            } else {
                const lines = stdout.trim().split('\n');
                console.log(stdout.trim())

                this.currentData.drive = []

                for (let i = 0; i < lines.length; i++) {

                    switch (i) {
                        case 0:
                            const [id_cpu, cpu_name, cpu_usage] = lines[i].replaceAll("\r", "").split(',');
                            if (id_cpu === "cpu") {
                                this.currentData.cpu.cpuName = cpu_name
                                this.currentData.cpu.cpuUsage = cpu_usage
                            }

                        case 1:
                            const [id_ram, ram_used, ram_total] = lines[i].replaceAll("\r", "").split(',');
                            if (id_ram === "ram") {
                                this.currentData.cpu.memoryUsage = `${(ram_used / (1024 * 1024)).toFixed(2)}`
                                this.currentData.cpu.memoryTotal = `${(ram_total / (1024 * 1024)).toFixed(2)}`
                            }

                        default:
                            const [id_drive, drive_name, drive_used, drive_total] = lines[i].replaceAll("\r", "").split(',');
                            if (id_drive === "drive") {
                                this.currentData.drive.push({
                                    drive_name: drive_name,
                                    total_Size: `${(drive_total / (1024 * 1024 * 1024)).toFixed(2)}`,
                                    use_Size: `${(drive_used / (1024 * 1024 * 1024)).toFixed(2)}`,
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

        // this.currentData.gpu[0].temperature="20"
        // this.currentData.gpu[1].temperature="10"
        // console.log(this.currentData.drive)

        return this.currentData;
    }

}

module.exports = {
    activate
};
