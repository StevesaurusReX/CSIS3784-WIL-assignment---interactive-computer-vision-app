const GUN_IDS = [9, 10, 11];
const POWERUP_IDS = [12, 13, 14];
const TREASURE_ID = 15;

// Get DOM elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const shutterBtn = document.getElementById("shutterBtn");

let currentStream = null;
let myId = null;
let detector = null;

function initializeDetection() {
  // Check if required elements exist
  if (!video || !canvas || !shutterBtn) {
    console.error("Required DOM elements not found");
    return;
  }

  // Check if ArUco detector is available
  if (typeof AR === 'undefined' || !AR.Detector) {
    console.error("ArUco library not loaded");
    return;
  }
  
  if (typeof CV === 'undefined') {
    console.error("CV library not loaded");
    return;
  }

  try {
    // Create detector with standard ARUCO dictionary (as in working version)
    detector = new AR.Detector();
    console.log("ArUco detector initialized");
  } catch (error) {
    console.error("Failed to create ArUco detector:", error);
    return;
  }

  shutterBtn.disabled = true;
  
  getCameras()
    .then(() => {
      console.log("Camera initialized");
    })
    .catch((error) => {
      console.error("Camera initialization failed:", error);
    });
    
  setupShutterListener();

  // Request symbol from server
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit("request_symbol");
    socket.on("your_symbol", ({ symbol }) => {
      myId = symbol;
      shutterBtn.disabled = false;
    });
  }
}

async function getCameras() {
  try {
    // Test camera access first
    const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
    testStream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    alert("Camera access is required for this app. Please allow camera access and refresh the page.");
    throw err;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    
    if (videoInputs.length === 0) {
      throw new Error("No cameras found");
    }

    // Prefer back/rear cameras for AR
    const rearCams = videoInputs.filter((d) => {
      const label = d.label.toLowerCase();
      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment")
      );
    });

    const camsToShow = rearCams.length > 0 ? rearCams : videoInputs;
    await startCamera(camsToShow[0].deviceId);
  } catch (err) {
    throw err;
  }
}

async function startCamera(deviceId) {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  try {
    const constraints = {
      video: { 
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;
    
    // Wait for video to be ready
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play()
          .then(() => {
            console.log("Camera started successfully"); // <-- KEY LINE
            if (typeof updateDebugInfo === 'function') updateDebugInfo('camera', 'ready');
            resolve();
          })
          .catch(reject);
      };
      video.onerror = reject;
      setTimeout(() => {
        if (video.readyState < 2) {
          reject(new Error("Video loading timeout"));
        }
      }, 10000);
    });
    
  } catch (err) {
    // Try fallback without exact device constraint
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      currentStream = fallbackStream;
      video.srcObject = fallbackStream;
      
      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(() => {
              console.log("Camera started successfully (fallback)");
              if (typeof updateDebugInfo === 'function') updateDebugInfo('camera', 'ready');
              resolve();
            })
            .catch(reject);
        };
        video.onerror = reject;
      });
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}

function setupShutterListener() {
  shutterBtn.addEventListener("click", (event) => {
    event.preventDefault();
    
    // Check if we have our symbol
    if (myId === null || myId === undefined) {
      console.warn("Symbol not assigned yet");
      return;
    }

    // Check if detector is ready
    if (!detector) {
      console.error("Detector not initialized");
      return;
    }

    // Check if video is ready
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.warn("Video not ready");
      return;
    }

    // Check video dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("Video dimensions not available");
      return;
    }

    try {
      processFrame();
    } catch (error) {
      console.error("Error processing frame:", error);
    }
  });
}

function processFrame() {
  // Canvas sizing
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext("2d");
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const markers = detector.detect(imageData);
console.log("Detected markers:", markers);

  if (vw === 0 || vh === 0) {
    return;
  }

  const videoAspect = vw / vh;
  const screenAspect = sw / sh;

  let sx, sy, sWidth, sHeight;
  if (videoAspect > screenAspect) {
    sHeight = vh;
    sWidth = vh * screenAspect;
    sx = (vw - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = vw;
    sHeight = vw / screenAspect;
    sx = 0;
    sy = (vh - sHeight) / 2;
  }

  // Draw video to canvas
  ctx.drawImage(
    video,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Get reticle position
  const reticle = document.querySelector(".reticle");
  if (!reticle) {
    console.error("Reticle not found");
    return;
  }
  
  const reticleRect = reticle.getBoundingClientRect();

  // Map to canvas scale
  const scaleX = canvas.width / window.innerWidth;
  const scaleY = canvas.height / window.innerHeight;

  const x = Math.floor(reticleRect.left * scaleX);
  const y = Math.floor(reticleRect.top * scaleY);
  const width = Math.floor(reticleRect.width * scaleX);
  const height = Math.floor(reticleRect.height * scaleY);

  // Bounds check
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || 
      x + width > canvas.width || y + height > canvas.height) {
    return;
  }

  try {
    // Get image data from the reticle area
    const imageData = ctx.getImageData(x, y, width, height);
    
    // Create temporary canvas for detection (as in working version)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);

    // Run ArUco detection
    const markers = detector.detect(tempCtx.getImageData(0, 0, width, height));

    if (markers && markers.length > 0) {
      markers.forEach((marker) => {
        const id = marker.id;
        console.log("Detected ArUco ID:", id);

        // Process the detected marker
        if (id >= 0 && id <= 8) {
          // It's a player symbol
          if (id !== myId) {
            shootPlayer(id);
          }
        } else if (GUN_IDS.includes(id)) {
          changeGun(id);
        } else if (POWERUP_IDS.includes(id)) {
          powerUp(id);
        } else if (id === TREASURE_ID) {
          findTreasure();
        }
      });
    }
  } catch (error) {
    console.error("Error during ArUco detection:", error);
  }
}

// Game action functions
function shootPlayer(targetSymbol) {
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit("shoot", targetSymbol);
  }
}

function powerUp(targetSymbol) {
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit("powerUp", targetSymbol);
  }
}

function findTreasure() {
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit("treasure_found");
  }
}

function changeGun(targetSymbol) {
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit("change_gun", targetSymbol);
  }
}

function getMyArucoId() {
  const me = allPlayers.find((p) => p.id === socket.id);
  return me ? me.arucoId : -1;
}

// Make processFrame available globally for testing
window.processFrame = processFrame;

// Clean up when page unloads
window.addEventListener("beforeunload", () => {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }
});