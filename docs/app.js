const cfg = window.APP_CONFIG;

function setStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
}

async function start() {
  // Basic sanity checks
  if (!cfg) throw new Error("APP_CONFIG missing. config.js not loaded?");
  const siteSelect = document.getElementById("siteSelect");
  const startBtn = document.getElementById("startCamera");
  const captureBtn = document.getElementById("capture");
  const syncBtn = document.getElementById("syncNow");
  const windowLabel = document.getElementById("windowLabel");

  if (!siteSelect || !startBtn || !captureBtn || !syncBtn) {
    throw new Error("HTML element IDs mismatch. Check index.html IDs.");
  }

  windowLabel.textContent = "JS OK. Ready.";
  setStatus("तैयार है। कैमरा चालू करें।");

  // Populate sites
  siteSelect.innerHTML = "";
  (cfg.SITES || []).forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.siteId;
    opt.textContent = s.nameHi || s.siteId;
    siteSelect.appendChild(opt);
  });

  let stream = null;

  startBtn.onclick = async () => {
    try {
      setStatus("कैमरा चालू हो रहा है...");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      const video = document.getElementById("video");
      video.srcObject = stream;
      captureBtn.disabled = false;
      setStatus("कैमरा चालू है। अब फोटो लें।");
    } catch (e) {
      setStatus("कैमरा नहीं चला। परमिशन चेक करें।");
      throw e;
    }
  };

  captureBtn.onclick = async () => {
    const video = document.getElementById("video");
    if (!video.videoWidth) {
      setStatus("वीडियो तैयार नहीं है। 2 सेकंड बाद फोटो लें।");
      return;
    }
    const canvas = document.getElementById("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx2 = canvas.getContext("2d");
    ctx2.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    setStatus("फोटो कैप्चर हो गई। (टेस्ट) साइज: " + Math.round(dataUrl.length/1024) + " KB");
  };

  syncBtn.onclick = () => {
    setStatus("Sync अभी disabled (test build). पहले camera confirm करें.");
  };
}

start();
