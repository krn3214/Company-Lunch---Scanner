let video = document.createElement("video");
let canvasElement = document.getElementById("canvas");
let canvas = canvasElement.getContext("2d");
let outputData = document.getElementById("outputData");
let startButton = document.getElementById("startScan");

let scanning = false;

// Patch: Explicit camera permission request and facing mode preference
async function startScan() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // iOS fix
        video.play();
        scanning = true;
        requestAnimationFrame(tick);
    } catch (err) {
        console.error("Camera access error:", err);
        alert("Unable to access camera. Please check browser permissions and ensure you're on HTTPS.");
    }
}

function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.hidden = false;
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        
        if (code) {
            scanning = false;
            video.srcObject.getTracks().forEach(track => track.stop());
            outputData.innerText = `Scanned Data: ${code.data}`;
        }
    }
    requestAnimationFrame(tick);
}

startButton.addEventListener("click", startScan);
