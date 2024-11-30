(function () {
    const vscode = acquireVsCodeApi();

    const canvas = document.getElementById('gpuUsageChart');
    const ctx = canvas.getContext('2d');

    let data = [];

    function drawAxes() {
        const padding = 0;
        const width = canvas.width - padding;
        const height = canvas.height + 10 - padding;
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;

        // แกน Y
        ctx.beginPath();
        ctx.moveTo(padding, 0);
        ctx.lineTo(padding, height);
        ctx.stroke();

        // แกน X
        ctx.beginPath();
        ctx.moveTo(padding, height);
        ctx.lineTo(canvas.width, height);
        ctx.stroke();

        // เส้นตารางและป้ายกำกับแกน Y
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        // for (let i = 0; i <= 100; i += 20) {
        //     const y = height - (i / 100) * height+55;
        //     ctx.beginPath();
        //     ctx.moveTo(padding, y-10);
        //     ctx.lineTo(width+30, y-10);
        //     ctx.strokeStyle = '#ddd';
        //     ctx.stroke();

        //     ctx.fillText(i + '%', padding - 5, y);
        // }

        // ป้ายกำกับแกน X
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 60; i += 10) {
            const x = padding + (i / 60) * width;
            ctx.fillText(i + 's', x + 10, height - 20);
        }
    }
    function map(x, in_min, in_max, out_min, out_max) {
        return ((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);

    }

    function line(text = "cpu",unit="%",value_max=100 , index = 0,sl=true,color = 'rgba(255, 0, 0, 255)') {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const padding = 0;
        const width = canvas.width - padding;
        const height = canvas.height - padding;
        const stepX = width / 59;
        for (let i = 0; i < data.length; i++) {
            const x = padding + i * stepX;
            const y = (height - (map(data[i][index][0],0,value_max,0,100) / 160) * height) - 20;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        if (data.length > 0) {
            ctx.font = 'bold 15px Arial';
            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';

            var un=`/${value_max}${unit}`
            ctx.fillText(`${text}${sl ? un:unit}`, canvas.width - (index * 150), 10);
            
        }
    }

    function updateChart(newData) {
        data = newData

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxes();

        // วาดกราฟ
        var label=["Vram","GPU"]
        // var label=["Ram","CPU"]
        var unit=["GB","%"]
        var la=[true,false]
        var colors=["#eb8c34","#50c714"]

        for(let index=0;index<newData[newData.length - 1].length;index++){
            line(`${label[index]} ${data[data.length - 1][index][0]}`,unit[index], data[data.length - 1][index][1],index,la[index],colors[index]);
        }
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'update':
                // updateChart(message.data);
                console.log("jj")
                break;
        }
    });

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        updateChart(data);
      
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
})();
