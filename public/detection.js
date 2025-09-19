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
  console.log("🔍 Initializing detection system...");
  
  // Check if required elements exist
  if (!video) {
    console.error("❌ Video element not found");
    return;
  }
  if (!canvas) {
    console.error("❌ Canvas element not found");
    return;
  }
  if (!shutterBtn) {
    console.error("❌ Shutter button not found");
    return;
  }

  // Check if ArUco detector is available
  if (typeof AR === 'undefined' || !AR.Detector) {
    console.error("❌ ArUco library not loaded");
    return;
  }

  try {
    detector = new AR.Detector();
    console.log("✅ ArUco detector created");
  } catch (error) {
    console.error("❌ Failed to create ArUco detector:", error);
    return;
  }

  shutterBtn.disabled = true;
  
  getCameras()
    .then(() => {
      console.log("✅ Camera initialization completed");
    })
    .catch((error) => {
      console.error("❌ Camera initialization failed:", error);
    });
    
  setupShutterListener();

  socket.emit("request_symbol");
  socket.on("your_symbol", ({ symbol }) => {
    console.log("🆔 Received symbol:", symbol);
    myId = symbol;
    shutterBtn.disabled = false;
    console.log("✅ Shutter button enabled");
  });
}

async function getCameras() {
  console.log("📹 Requesting camera access...");
  
  try {
    // Test camera access first
    const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
    testStream.getTracks().forEach((t) => t.stop());
    console.log("✅ Camera access granted");
  } catch (err) {
    console.error("❌ Camera access denied:", err);
    alert("Camera access is required for this app. Please allow camera access and refresh the page.");
    throw err;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    console.log("📷 Found cameras:", videoInputs.length);
    
    if (videoInputs.length === 0) {
      throw new Error("No cameras found");
    }

    const rearCams = videoInputs.filter((d) => {
      const label = d.label.toLowerCase();
      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment")
      );
    });

    const camsToShow = rearCams.length > 0 ? rearCams : videoInputs;
    console.log("🎯 Using camera:", camsToShow[0].label || "Unknown camera");

    await startCamera(camsToShow[0].deviceId);
  } catch (err) {
    console.error("❌ Failed to enumerate cameras:", err);
    throw err;
  }
}

async function startCamera(deviceId) {
  console.log("🎬 Starting camera...");
  
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  try {
    const constraints = {
      video: { 
        deviceId: { exact: deviceId },
        facingMode: "environment" // Prefer back camera
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
            console.log("✅ Camera started successfully");
            resolve();
          })
          .catch(reject);
      };
      video.onerror = reject;
    });
    
  } catch (err) {
    console.error("❌ Failed to start camera:", err);
    // Try fallback without exact device constraint
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      currentStream = fallbackStream;
      video.srcObject = fallbackStream;
      console.log("✅ Camera started with fallback constraints");
    } catch (fallbackErr) {
      console.error("❌ Fallback camera also failed:", fallbackErr);
      throw fallbackErr;
    }
  }
}

function setupShutterListener() {
  console.log("🔫 Setting up shutter button listener");
  
  shutterBtn.addEventListener("click", () => {
    console.log("📸 Shutter button clicked");
    
    // Check if we have our symbol
    if (!myId) {
      console.warn("🛑 Shoot blocked: symbol not assigned yet");
      return;
    }

    // Check if detector is ready
    if (!detector) {
      console.error("🛑 Shoot blocked: detector not initialized");
      return;
    }

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.warn("🛑 Shoot blocked: video not ready");
      return;
    }

    // Check if reticle exists
    const reticle = document.querySelector(".reticle");
    if (!reticle) {
      console.error("🛑 Shoot blocked: reticle not found");
      return;
    }

    try {
      processFrame();
    } catch (error) {
      console.error("❌ Error processing frame:", error);
    }
  });
}

function processFrame() {
  // Ensure canvas matches screen
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Draw current video frame to canvas
  const ctx = canvas.getContext("2d");

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = window.innerWidth;
  const sh = window.innerHeight;

  if (vw === 0 || vh === 0) {
    console.warn("⚠️ Video dimensions not available yet");
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

  // Reticle-based detection region
  const reticle = document.querySelector(".reticle");
  const reticleRect = reticle.getBoundingClientRect();

  // Map to canvas scale
  const scaleX = canvas.width / window.innerWidth;
  const scaleY = canvas.height / window.innerHeight;

  const x = Math.floor(reticleRect.left * scaleX);
  const y = Math.floor(reticleRect.top * scaleY);
  const width = Math.floor(reticleRect.width * scaleX);
  const height = Math.floor(reticleRect.height * scaleY);

  // Ensure bounds are valid
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || 
      x + width > canvas.width || y + height > canvas.height) {
    console.warn("⚠️ Invalid detection region bounds");
    return;
  }

  try {
    // Crop canvas region
    const imageData = ctx.getImageData(x, y, width, height);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);

    // Run ArUco detection
    const markers = detector.detect(tempCtx.getImageData(0, 0, width, height));

    if (markers.length > 0) {
      console.log(`🎯 Found ${markers.length} markers`);
      markers.forEach((marker) => {
        const id = marker.id;
        console.log("✅ Detected ArUco ID:", id);

        if (id >= 0 && id <= 8) {
          // It's a player
          if (id !== myId) {
            console.log("🔫 Shoot player with ID:", id);
            shootPlayer(id);
          } else {
            console.log("🚫 Ignored scanning self");
          }
        } else if (GUN_IDS.includes(id)) {
          console.log("🔧 Change gun to ID:", id);
          changeGun(id);
        } else if (POWERUP_IDS.includes(id)) {
          console.log("⚡ Power up with ID:", id);
          powerUp(id);
        } else if (id === TREASURE_ID) {
          console.log("💎 Found treasure!");
          findTreasure();
        } else {
          console.log(`❓ Unknown ArUco ID ${id}`);
        }
      });
    } else {
      console.log("❌ No ArUco marker detected inside reticle");
    }
  } catch (error) {
    console.error("❌ Error during ArUco detection:", error);
  }
}

function getMyArucoId() {
  const me = allPlayers.find((p) => p.id === socket.id);
  return me ? me.arucoId : -1;
}

// Clean up when page unloads
window.addEventListener("beforeunload", () => {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }
});