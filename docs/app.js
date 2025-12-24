const cfg = window.APP_CONFIG;

function setText(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function nowIso() { return new Date().toISOString(); }

function getCurrentWindow() {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const hhmm = `${hh}:${mm}`;
  if (hhmm < "11:30") return "MORNING";
  if (hhmm < "15:30") return "BEFORE_LUNCH";
  return "EVENING";
}

// HARD-TIMEOUT GEO so it never hangs
async function getGeo() {
  const hardTimeoutMs = 5000;

  return await Promise.race([
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve({ lat: null, lng: null, acc: null, err: "NO_GEO" });
      }

      navigator.geolocation.getCurrentPosition(
        (p) => resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          err: null
        }),
        (e) => resolve({
          lat: null,
          lng: null,
          acc: null,
          err: (e && e.message) ? e.message : "GEO_DENIED"
        }),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    }),
    new Promise((resolve) =>
      setTimeout(() => resolve({ lat: null, lng: null, acc: null, err: "GEO_TIMEOUT" }), hardTimeoutMs)
    )
  ]);
}

function makeId() {
  return (crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : ("id_" + Date.now() + "_" + Math.random().toString(16).slice(2));
}

function siteById(id) {
  return (cfg.SITES || []).find(s => s.siteId === id);
}

async function renderQueue() {
  const items = await qGetAll();
  const q = document.getElementById("queue");
  if (!items.length) {
    q.textContent = "क्यू खाली है।";
    return;
  }
  q.innerHTML = items
    .map(i => `• ${i.siteNameHi} | ${i.windowType} | ${i.capturedAtIso} | ${i.uploadState}`)
    .join("<br/>");
}

async function uploadOne(item) {
  // NOTE: no-cors => browser will not let us read JSON response.
  // We treat "request sent" as success and verify via Sheet/Drive.
  await fetch(cfg.UPLOAD_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });

  return { ok: true };
}


async function syncQueue() {
  const items = await qGetAll();
  if (!items.length) {
    setText("status", "कुछ भी पेंडिंग नहीं।");
    return;
  }

  setText("status", `सिंक शुरू… (${items.length})`);

  for (const it of items) {
    try {
      it.uploadState = "UPLOADING";
      await qPut(it);
      await renderQueue();

      const out = await uploadOne(it);

      if (out && out.ok) {
  // Keep in queue for now; mark SENT.
  it.uploadState = "SENT";
  await qPut(it);
  await renderQueue();
  setText("status", `अपलोड भेज दिया: ${it.siteNameHi} (शीट में चेक करें)`);
} else {
  ...
}

       setText("status", `अपलोड भेज दिया: ${it.siteNameHi} (शीट में चेक करें)`);
      } else {
        it.uploadState = "FAILED";
        await qPut(it);
        setText("status", `अपलोड फेल: ${it.siteNameHi} (server response)`);
        break;
      }

      await renderQueue();

    } catch (e) {
      it.uploadState = "FAILED";
      await qPut(it);
      await renderQueue();
      console.error(e);
      setText("status", `अपलोड फेल: ${it.siteNameHi} : ${String(e)}`);
      break;
    }
  }
}

async function start() {
  if (!cfg) throw new Error("APP_CONFIG missing. config.js not loaded?");

  // Update UI immediately
  setText("windowLabel", `आज की विंडो: ${getCurrentWindow()}`);
  setText("status", "ऐप शुरू हो रहा है...");

  // Try DB but do not block app
  try {
    await openDb();
    setText("status", "DB OK. कैमरा चालू करें।");
  } catch (e) {
    console.error("IndexedDB/openDb failed:", e);
    setText("status", "DB फेल. ऑफलाइन क्यू नहीं चलेगा, लेकिन अपलोड चलेगा।");
  }

  // Populate sites
  const sel = document.getElementById("siteSelect");
  sel.innerHTML = "";
  (cfg.SITES || []).forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.siteId;
    opt.textContent = s.nameHi || s.siteId;
    sel.appendChild(opt);
  });

  const startBtn = document.getElementById("startCamera");
  const captureBtn = document.getElementById("capture");
  const syncBtn = document.getElementById("syncNow");

  let stream = null;

  startBtn.onclick = async () => {
    try {
      setText("status", "कैमरा चालू हो रहा है...");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      const video = document.getElementById("video");
      video.srcObject = stream;
      captureBtn.disabled = false;
      setText("status", "कैमरा चालू है। अब फोटो लें।");
    } catch (e) {
      console.error(e);
      setText("status", "कैमरा नहीं चला। परमिशन Allow करें।");
    }
  };

captureBtn.onclick = async () => {
  try {
    const siteId = sel.value;
    const site = siteById(siteId);
    if (!site) { setText("status", "साइट चुनें।"); return; }

    const scaleEl = document.getElementById("scaleUsed");
    const scaleUsed = scaleEl ? scaleEl.checked : false;

    // 1) CAPTURE IMAGE FIRST (never wait for GPS)
    const video = document.getElementById("video");
    if (!video.videoWidth) {
      setText("status", "वीडियो तैयार नहीं है। 2 सेकंड बाद फोटो लें।");
      return;
    }

    const canvas = document.getElementById("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx2 = canvas.getContext("2d");
    ctx2.drawImage(video, 0, 0);

    // Keep small for Apps Script
    const jpegBase64 = canvas.toDataURL("image/jpeg", 0.45);

    // 2) Create item with GPS = null initially
    const photoId = makeId();
    const item = {
      photoId,
      workerId: cfg.WORKER_ID,
      workerNameHi: cfg.WORKER_NAME_HI,
      projectId: "PROJECT_1",
      siteId,
      siteNameHi: site.nameHi,
      taskId: null,
      windowType: getCurrentWindow(),
      capturedAtIso: nowIso(),

      lat: null,
      lng: null,
      accuracyM: null,
      geoStatus: "UNKNOWN",

      scaleUsed,
      imageBase64: jpegBase64,
      uploadState: "PENDING"
    };

    // Save immediately
    await qPut(item);
    await renderQueue();
    setText("status", "फोटो सेव हो गई। लोकेशन लेने की कोशिश हो रही है…");

    // 3) Try GPS in background (do not block)
    const geo = await getGeo();
    if (geo && !geo.err && geo.lat != null) {
      item.lat = geo.lat;
      item.lng = geo.lng;
      item.accuracyM = geo.acc;
      // update stored item with GPS
      await qPut(item);
      await renderQueue();
      setText("status", "लोकेशन सेव हो गई। अब 'अभी सिंक करें' दबाएँ।");
    } else {
      setText("status", "लोकेशन नहीं मिली। फिर भी फोटो ठीक है। अब 'अभी सिंक करें' दबाएँ।");
    }

  } catch (e) {
    console.error(e);
    setText("status", "एरर: " + String(e));
  }
};


  syncBtn.onclick = syncQueue;
  window.addEventListener("online", syncQueue);

  await renderQueue();
}

start();
