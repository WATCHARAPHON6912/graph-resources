function openPopup() {
    document.getElementById('popupMenu').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

// ฟังก์ชันปิด popup
function closePopup() {
    document.getElementById('popupMenu').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}
(function () {
    const vscode = acquireVsCodeApi();
    let charts = {
        cpuRam: null,
        gpus: null,
    };
    let settings;
    let label_index = 0;

    function generateRandomData(min = 0, max = 100) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    function createDualLineChart(canvasId, labels, colors = ['#4f46e5', '#ef4444']) {
        const timeValue = document.getElementById('time')?.value || "30";
        const timeInt = parseInt(timeValue, 10) || 30;
        const ctx = document.getElementById(canvasId).getContext('2d');
        const initialData = Array(timeInt + 1).fill(0);

        const text_color = "#ffffff";
        const y_color = "#6e6e6e";
        const x_font_size = 10;
        const y_font_size = 11;
        const labels_font_size = 11;

        const chart = [];
        for (let i = 0; i < labels.length; i++) {
            chart.push({
                label: labels[i],
                data: [...initialData],
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                tension: 0.2,
                fill: true,
                pointRadius: 0,
                borderWidth: 1.5,
                hidden: false  // <-- แสดงเส้นทั้งหมด
            });
        }

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(timeInt + 1).fill(''),
                datasets: chart
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        max: 100,
                        grid: {
                            color: y_color,
                        },
                        ticks: {
                            color: text_color,
                            font: {
                                size: y_font_size,
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                        },
                        ticks: {
                            color: text_color,
                            font: {
                                size: x_font_size,
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        align: 'start',
                        labels: {
                            color: text_color,
                            font: {
                                size: labels_font_size,
                            }
                        },
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
            }
        });
    }


    // ฟังก์ชันบันทึกการตั้งค่าไปยัง Local Storage
    function saveSettings() {
        settings = {
            showCpu: document.getElementById('showCpu').checked,
            showSystemVram: document.getElementById('showSystemVram').checked,
            showGpus: document.getElementById('showGpus').checked,
            showGpuVram: document.getElementById('showGpuVram').checked,

            showCpuRamGraph: document.getElementById('showCpuRamGraph').checked,
            showGpuVramGraph: document.getElementById('showGpuVramGraph').checked,
            showTotalGpu: document.getElementById('showTotalGpu').checked,
            // showInternetGraph: document.getElementById('showInternetGraph').checked,
            gpuNValue: document.getElementById('gpuNValue').value,
            time: document.getElementById('time').value,
            chartHight: document.getElementById('chartHight').value
        };
        // console.log(settings)
        localStorage.setItem('systemMonitorSettings', JSON.stringify(settings));
    }

    // ฟังก์ชันโหลดการตั้งค่าจาก Local Storage
    function loadSettings() {
        const savedSettings = localStorage.getItem('systemMonitorSettings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            Object.keys(settings).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = settings[key];
                    }
                    else {
                        element.value = settings[key];
                    }
                }
            });
        }

        return savedSettings
    }

    function updateDisplay() {
        const container = document.querySelector('.container');
        const showCpuRamGraph = document.getElementById('showCpuRamGraph')?.checked ?? true;
        const showGpuVramGraph = document.getElementById('showGpuVramGraph')?.checked ?? true;
        const showTotalGpu = document.getElementById('showTotalGpu')?.checked ?? true;
        const chartHeight = document.getElementById('chartHight')?.value || "200";

        const chartContainers = document.querySelectorAll('.chart-container');

        // แสดง/ซ่อนกราฟหลักตาม checkbox
        if (chartContainers[0]) chartContainers[0].style.display = showCpuRamGraph ? 'block' : 'none';
        if (chartContainers[1]) chartContainers[1].style.display = showTotalGpu ? 'block' : 'none';

        // กราฟ GPU / VRAM
        for (let i = 2; i < chartContainers.length; i++) {
            chartContainers[i].style.display = showGpuVramGraph ? 'block' : 'none';
        }

        // กำหนดความกว้างและความสูงกราฟทั้งหมด
        chartContainers.forEach(container => {
            container.style.width = '100%';
            container.style.height = `${chartHeight}px`;
        });

        // ปรับ layout เป็นแนวตั้ง
        container.style.gridTemplateColumns = '1fr';
        container.style.gridTemplateRows = 'auto';

        saveSettings();
    }


    function createAndRenderDrives(drives) {
        const container = document.getElementById("drives-container");
        container.innerHTML = ""; // Clear previous content

        const title = document.createElement("div");
        title.classList.add("storage-title");
        title.textContent = "Storage Usage";
        container.appendChild(title);

        drives.forEach(drive => {
            const driveElement = document.createElement("div");
            driveElement.id = `drive-${drive.drive_name}`;
            driveElement.style.marginBottom = "1.5rem";

            // Create drive label container
            const driveLabel = document.createElement("div");
            driveLabel.style.display = "flex";
            driveLabel.style.justifyContent = "space-between";
            driveLabel.style.marginBottom = "0.5rem";

            // Left part (Drive Name)
            const driveName = document.createElement("span");
            driveName.textContent = `Drive: ${drive.drive_name}`;

            // Right part (Available Space)
            const driveAvail = document.createElement("span");
            driveAvail.textContent = `Avail: ${(drive.total_Size - drive.use_Size).toFixed(2)}GB`;

            // Append left and right parts to the driveLabel
            driveLabel.appendChild(driveName);
            driveLabel.appendChild(driveAvail);

            // Create storage bar
            const storageBar = document.createElement("div");
            storageBar.classList.add("storage-bar");

            const storageFill = document.createElement("div");
            storageFill.id = `drive-${drive.drive_name}-fill`;
            storageFill.classList.add("storage-fill");
            storageFill.style.width = `${(drive.use_Size / drive.total_Size) * 100}%`;

            const storageLabel = document.createElement("span");
            storageLabel.id = `drive-${drive.drive_name}-label`;
            storageLabel.classList.add("storage-label");
            storageLabel.textContent = `${drive.use_Size}/${drive.total_Size} GB`;

            storageFill.appendChild(storageLabel);
            storageBar.appendChild(storageFill);
            driveElement.appendChild(driveLabel);
            driveElement.appendChild(storageBar);
            container.appendChild(driveElement);
        });
    }

    window.addEventListener('load', function () {
        // โหลดการตั้งค่า
        loadSettings();
        createAndRenderDrives([]);

        charts.cpuRam = createDualLineChart('cpuRamChart', labels = ['CPU Usage', 'RAM'], colors = ['#4f46e5', '#ef4444']);
        charts.gpus = createDualLineChart('showTotalGpuVramGraph', labels = ['Gpus', 'VRAMs'], colors = ['#10b981', '#f59e0b']);
        create_gpu_chart()

        // เพิ่ม event listeners สำหรับ checkboxes
        const checkboxes = document.querySelectorAll('.menu-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateDisplay);
        });

        // เพิ่ม event listener สำหรับ GPU N input
        const gpuNInput = document.getElementById('gpuNValue');
        gpuNInput.addEventListener('change', (e) => {
            updateDisplay();
        });
        const chart_hight = document.getElementById('chartHight');
        chart_hight.addEventListener('change', (e) => {
            updateDisplay();
        });

        const time = document.getElementById('time');
        time.addEventListener('change', (e) => {
            updateDisplay();

            const chart_name = [charts.cpuRam.data, charts.gpus.data]
            for (j = 0; j <= 2; j++) {
                if (j == 2) {
                    for (let i = 0; i < settings.gpuNValue; i++) {
                        const canvasId = `gpuVramChart${i}`;
                        let c = charts[canvasId].data
                        if (c.labels.length > time.value) {
                            for (i = 0; i < c.datasets.length; i++) {
                                var update_ = c.datasets[i]
                                c.datasets[i].data = update_.data.slice(update_.data.length - parseInt(time.value, 10) - 1, update_.data.length)
                            }
                            let new_label = []
                            for (i = 0; i < parseInt(time.value, 10) + 1; i++) new_label.push(String(i) + "s");
                            c.labels = new_label
                        }
                        else if (c.labels.length < time.value) {
                            for (i = 0; i < c.datasets.length; i++) {
                                var update_ = c.datasets[i];
                                c.datasets[i].data = Array(parseInt(time.value, 10) - update_.data.length + 1).fill(0).concat(update_.data);
                            }
                            let new_label = []
                            for (i = 0; i < parseInt(time.value, 10) + 1; i++) new_label.push(String(i) + "s");
                            c.labels = new_label
                        }
                    }
                }
                else {
                    let c = chart_name[j]
                    if (c.labels.length > time.value) {
                        for (i = 0; i < c.datasets.length; i++) {
                            var update_ = c.datasets[i]
                            c.datasets[i].data = update_.data.slice(update_.data.length - parseInt(time.value, 10) - 1, update_.data.length)
                        }
                        let new_label = []
                        for (i = 0; i < parseInt(time.value, 10) + 1; i++) new_label.push(String(i) + "s");
                        c.labels = new_label
                    }
                    else if (c.labels.length < time.value) {
                        for (i = 0; i < c.datasets.length; i++) {
                            var update_ = c.datasets[i];
                            c.datasets[i].data = Array(parseInt(time.value, 10) - update_.data.length + 1).fill(0).concat(update_.data);
                        }
                        let new_label = []
                        for (i = 0; i < parseInt(time.value, 10) + 1; i++) new_label.push(String(i) + "s");
                        c.labels = new_label
                    }
                }
            }

        });

        // Event listener สำหรับ overlay click to close
        document.getElementById('overlay').addEventListener('click', closePopup);

        // อัพเดต UI ครั้งแรก
        updateDisplay();

        // เริ่มการอัพเดต real-time
        // startRealtimeUpdates();
    });

    function create_gpu_chart() {
        const container = document.getElementById("chartContainer");
        for (let i = 0; i < settings.gpuNValue; i++) {
            const canvasId = `gpuVramChart${i}`;
            const existingCanvas = document.getElementById(canvasId);
            if (existingCanvas) {
                existingCanvas.parentElement.remove();
            }
            const chartDiv = document.createElement("div");
            chartDiv.className = "chart-container";
            const canvas = document.createElement("canvas");
            canvas.id = canvasId;
            chartDiv.appendChild(canvas);
            container.appendChild(chartDiv);
            charts[canvasId] = createDualLineChart(canvasId, labels = ['GPU Usage', 'VRAM'], colors = ['#10b981', '#f59e0b']);
        }
    }


    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'update':

                createAndRenderDrives(message.data.drive);
                if (charts.cpuRam && document.getElementById('showCpuRamGraph').checked) {
                    updateDualChartData(charts.cpuRam, message.data);
                }
                if (charts.gpus && document.getElementById('showTotalGpu').checked) {
                    updateDualChartData(charts.gpus, message.data);
                }
                // if (charts.gpuTotalChart && document.getElementById('showTotalGpuVramGraph').checked) {
                //     updateDualChartData(chart.gpuTotalChart, message.data,"");
                // }
                const container = document.getElementById("chartContainer");
                const validCanvasIds = ["cpuRamChart", "showTotalGpuVramGraph"];

                for (let i = 0; i < settings.gpuNValue; i++) {
                    const canvasId = `gpuVramChart${i}`;
                    validCanvasIds.push(canvasId);
                    let canvas = document.getElementById(canvasId);

                    if (!canvas) {
                        // ถ้าไม่มี canvas ให้สร้างใหม่
                        const chartDiv = document.createElement("div");
                        chartDiv.className = "chart-container";

                        canvas = document.createElement("canvas");
                        canvas.id = canvasId;

                        chartDiv.appendChild(canvas);
                        container.appendChild(chartDiv);
                        charts[canvasId] = createDualLineChart(canvasId, labels = ['GPU Usage', 'VRAM'], colors = ['#10b981', '#f59e0b']);
                    }
                    if (charts[canvasId] && document.getElementById('showGpuVramGraph').checked) {
                        updateDualChartData(charts[canvasId], message.data, i);
                    }
                }

                Array.from(container.querySelectorAll("canvas")).forEach(canvas => {
                    if (!validCanvasIds.includes(canvas.id)) {
                        const chartDiv = canvas.parentElement;
                        chartDiv.remove();
                        delete charts[canvas.id]; // ลบออกจาก charts object
                    }
                });
                break;
        }
    });


    // ฟังก์ชันอัพเดตข้อมูลกราฟที่มี 2 เส้น
    let te = 0;
    function updateDualChartData(chart, new_data, chart_id = "") {
        const datasets = chart.data.datasets;
        const time = document.getElementById('time').value;

        if (document.getElementById('gpuNValue').value > new_data.gpu.length) {
            document.getElementById('gpuNValue').value = new_data.gpu.length;
            updateDisplay();
        }

        const map_show = {
            "C": settings.showCpu,
            "R": settings.showSystemVram,
            "G": settings.showGpus,
            "V": settings.showGpuVram,
            "T": settings.showTotalGpu,
        }
        const map_label = {
            "C": "CPU Usage",
            "R": "RAM",
            "G": "GPU Usage",
            "V": "VRAM",
            "T": "Total GPUs",
        }

        let index_label = 0;
        let num_gpu = chart_id;
        datasets.forEach(dataset => {
            index_label++;
            const data = dataset.data;
            dataset.label = map_label[dataset.label[0]] + " " + String(index_label)
            dataset.hidden = !map_show[dataset.label[0]];

            data.shift();

            if (dataset.label[0] === "C") {
                data.push(parseFloat(new_data.cpu.cpuUsage));
                dataset.label = map_label[dataset.label[0]]
            }
            else if (dataset.label[0] === "R") {
                data.push((parseFloat(new_data.cpu.memoryUsage) / parseFloat(new_data.cpu.memoryTotal)) * 100);
                dataset.label = `RAM ${new_data.cpu.memoryUsage}/${new_data.cpu.memoryTotal}GB`
            }
            else if (dataset.label[0] === "G" && num_gpu === "") {
                let total = 0
                for (var x = 0; x < new_data.gpu.length; x++) {
                    total += parseFloat(new_data.gpu[x].gpuUsage)
                }

                dataset.label = `GPU: ${new_data.gpu.length}GPU`
                data.push((total / new_data.gpu.length).toFixed(2));
            }
            else if (dataset.label[0] === "V" && num_gpu === "") {
                let total = 0
                let used = 0
                for (var x = 0; x < new_data.gpu.length; x++) {
                    total += parseFloat(new_data.gpu[x].memoryTotal)
                    used += parseFloat(new_data.gpu[x].memoryUsage)
                }
                dataset.label = `Vram ${used}/${total}GB`
                data.push((used / total) * 100);
            }
            else if (dataset.label[0] === "G") {
                data.push(parseFloat(new_data.gpu[num_gpu].gpuUsage));
                dataset.label = `GPU${num_gpu}: ${new_data.gpu[num_gpu].device}`
            }
            else if (dataset.label[0] === "V") {
                data.push((parseFloat(new_data.gpu[num_gpu].memoryUsage) / parseFloat(new_data.gpu[num_gpu].memoryTotal)) * 100);
                dataset.label = `VRAM ${new_data.gpu[num_gpu].memoryUsage}/${new_data.gpu[num_gpu].memoryTotal}GB`
            }
            else {

            }

        });

        const labels = chart.data.labels;
        if (labels[0] == "") {
            const va = []
            for (j = 0; j < labels.length; j++) {
                if (labels[j] == "") {
                    va.push("g")
                }
            }
            const timeString = String(parseInt(time, 10) - va.length + 1) + "s"
            labels.shift();
            labels.push(timeString);
        }

        for (var i = 0; i < new_data.drive.length; i++) {
            new_data.drive[i].total_Size = parseFloat(new_data.drive[i].total_Size)
            new_data.drive[i].use_Size = parseFloat(new_data.drive[i].use_Size)
        }

        createAndRenderDrives(new_data.drive);
        chart.update('none');
    }



})();