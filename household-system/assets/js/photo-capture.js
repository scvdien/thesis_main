(function () {
  "use strict";

  const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  const DEFAULT_MAX_OUTPUT_BYTES = 900 * 1024;
  const MIN_NATIVE_CAMERA_APP_VERSION = 5;
  // Versioned so an older saved phone/virtual-camera choice is not reopened.
  const DESKTOP_CAMERA_STORAGE_KEY = "cabarianPreferredPhysicalCameraV2";
  let cameraDialog = null;
  let activeCameraCancel = null;

  const getNativeCameraAppVersion = () => {
    const match = String(window.navigator?.userAgent || "").match(/CabarianRegistrationApp\/(\d+)/i);
    return match ? Number.parseInt(match[1], 10) || 0 : 0;
  };

  const stopCameraStream = (stream) => {
    if (!stream || typeof stream.getTracks !== "function") return;
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // The camera track may already be stopped by the browser.
      }
    });
  };

  const getCameraErrorMessage = (error) => {
    const name = String(error?.name || "");
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "I-allow ang camera permission sa browser, pagkatapos ay subukan ulit.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Walang camera na nakita sa device na ito.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Hindi mabuksan ang camera. Isara muna ang ibang app o tab na gumagamit nito.";
    }
    if (name === "SecurityError") {
      return "Hindi pinayagan ng browser ang camera. Gumamit ng HTTPS o http://localhost.";
    }
    if (name === "AbortError") {
      return "Naputol ang pagbukas ng camera. Subukan ulit.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "Hindi available ang napiling camera setting. Subukan ulit.";
    }
    if (error instanceof Error && error.message) return error.message;
    return "Hindi mabuksan ang camera sa device na ito.";
  };

  const isLikelyMobileDevice = () => {
    if (typeof window.navigator?.userAgentData?.mobile === "boolean") {
      return window.navigator.userAgentData.mobile;
    }
    const userAgent = String(window.navigator?.userAgent || "");
    const isTouchIPad = /Macintosh/i.test(userAgent) && Number(window.navigator?.maxTouchPoints || 0) > 1;
    return isTouchIPad || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  };

  const isExcludedCameraDevice = (device) => {
    const rawLabel = String(device?.label || device || "");
    const label = (rawLabel.normalize ? rawLabel.normalize("NFKC") : rawLabel)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!label) return false;
    return (
      /\bvirtual(?:\s*(?:camera|webcam|cam))?\b|\bvirtualcam\b|\bvcam\b/.test(label)
      || /\b(?:phone link|link to windows|continuity camera|intel unison)\b/.test(label)
      || /\b(?:droidcam|iriun|epoccam|ivcam|camo(?: studio)?|manycam|snap camera|xsplit(?: vcam)?|nvidia broadcast|windows studio effects|cyberlink youcam|screen capture)\b/.test(label)
      || /\bobs(?:[- ](?:virtual )?camera)?\b/.test(label)
      || /(?:^|[\s(._-])ir(?:$|[\s)._-])|\b(?:infrared|windows hello|hello face|depth(?: camera)?|realsense|time[- ]of[- ]flight|tof camera)\b/.test(label)
      || /\bitel\s+p55\s+5g\b/.test(label)
    );
  };

  const listAllVideoInputDevices = async () => {
    if (!window.navigator?.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await window.navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
    } catch {
      return [];
    }
  };

  const listVideoInputDevices = async () => {
    const devices = await listAllVideoInputDevices();
    // Desktop only: keep real built-in cameras and physical USB webcams.
    return devices.filter((device) => !isExcludedCameraDevice(device));
  };

  const getSavedDesktopCameraId = () => {
    try {
      return String(window.localStorage.getItem(DESKTOP_CAMERA_STORAGE_KEY) || "");
    } catch {
      return "";
    }
  };

  const saveDesktopCameraId = (deviceId) => {
    try {
      if (deviceId) {
        window.localStorage.setItem(DESKTOP_CAMERA_STORAGE_KEY, String(deviceId));
      } else {
        window.localStorage.removeItem(DESKTOP_CAMERA_STORAGE_KEY);
      }
    } catch {
      // Camera selection still works when storage is unavailable.
    }
  };

  const getCameraDeviceScore = (device) => {
    const label = String(device?.label || "").toLowerCase();
    if (isExcludedCameraDevice(device)) return -1000;
    let score = 0;
    if (/\bpc camera\b/.test(label)) score += 240;
    if (/user facing|front camera/.test(label)) score += 160;
    if (/integrated|built[ -]?in/.test(label)) score += 120;
    if (/webcam|usb camera|hd camera|fhd camera/.test(label)) score += 50;
    if (/\bir\b|infrared|windows hello|depth camera/.test(label)) score -= 300;
    if (/virtual|obs|manycam|droidcam|snap camera|epoccam|screen capture/.test(label)) score -= 250;
    return score;
  };

  const getCameraDisplayLabel = (label, fallback = "Camera") => {
    const cleanedLabel = String(label || "")
      .replace(/\s+/g, " ")
      .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}(?::[0-9a-f]{4})?\)\s*$/i, "")
      .trim();
    return cleanedLabel || fallback;
  };

  const getMobileCameraFacingMode = (device, fallback = "") => {
    const label = String(device?.label || "").toLowerCase();
    if (/\bfront\b|\buser\b|facetime|selfie/.test(label)) return "user";
    if (/\bback\b|\brear\b|\benvironment\b|world camera/.test(label)) return "environment";
    return fallback;
  };

  const findPreferredDesktopCamera = (devices, savedDeviceId = "") => {
    const availableDevices = Array.isArray(devices) ? devices : [];
    const savedDevice = availableDevices.find((device) => device.deviceId === savedDeviceId);
    if (savedDevice) return savedDevice;
    const ranked = availableDevices
      .filter((device) => device.deviceId)
      .map((device) => ({ device, score: getCameraDeviceScore(device) }))
      .sort((left, right) => right.score - left.score);
    return ranked.length ? ranked[0].device : null;
  };

  const requestCameraStream = async ({ deviceId = "", facingMode = "", strictFacingMode = false } = {}) => {
    const isMobileCamera = isLikelyMobileDevice();
    if (!isMobileCamera) {
      // An exact saved device opens quickly and avoids Windows choosing an IR/virtual endpoint.
      const video = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "user" } };
      return window.navigator.mediaDevices.getUserMedia({ audio: false, video });
    }

    if (deviceId) {
      return window.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 }
        }
      });
    }

    const requestedFacingMode = facingMode === "user" ? "user" : "environment";

    try {
      return await window.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: strictFacingMode
            ? { exact: requestedFacingMode }
            : { ideal: requestedFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 }
        }
      });
    } catch (error) {
      const name = String(error?.name || "");
      const canRetryWithoutPreferredSettings = [
        "OverconstrainedError",
        "ConstraintNotSatisfiedError",
        "TypeError"
      ].includes(name);
      if (strictFacingMode || !canRetryWithoutPreferredSettings) throw error;
      return window.navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
  };

  const getCameraDialog = () => {
    if (cameraDialog) return cameraDialog;

    const overlay = document.createElement("div");
    overlay.className = "registration-camera-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="registration-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="registrationCameraTitle" aria-describedby="registrationCameraHelp">
        <header class="registration-camera-header">
          <div class="registration-camera-heading">
            <div class="registration-camera-title-row">
              <strong id="registrationCameraTitle">Camera</strong>
              <span class="registration-camera-ready" role="status" aria-live="polite" hidden>
                <span class="registration-camera-ready-dot" aria-hidden="true"></span>
                <span class="registration-camera-ready-text">Camera Ready</span>
              </span>
            </div>
            <small class="registration-camera-help" id="registrationCameraHelp">I-center nang malinaw bago kumuha ng larawan.</small>
          </div>
          <button type="button" class="registration-camera-close" aria-label="Close camera">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </header>
        <div class="registration-camera-source" hidden>
          <label for="registrationCameraDevice">
            <i class="bi bi-camera-video-fill" aria-hidden="true"></i>
            Camera
          </label>
          <select id="registrationCameraDevice" class="registration-camera-select" aria-label="Choose camera"></select>
          <span class="registration-camera-source-status visually-hidden" aria-live="polite"></span>
        </div>
        <div class="registration-camera-viewfinder">
          <video autoplay muted playsinline disablepictureinpicture controlslist="nopictureinpicture" aria-label="Live camera preview"></video>
          <div class="registration-camera-frame-guide" aria-hidden="true"></div>
          <div class="registration-camera-message" role="status" aria-live="polite">Binubuksan ang camera...</div>
        </div>
        <footer class="registration-camera-actions">
          <button type="button" class="btn btn-outline-light registration-camera-cancel">Cancel</button>
          <button type="button" class="btn btn-primary registration-camera-shutter" aria-label="Capture photo" title="Press Enter or Space to capture" disabled>
            <i class="bi bi-camera-fill" aria-hidden="true"></i>
            <span class="registration-camera-shutter-label">Capture Photo</span>
          </button>
          <button type="button" class="btn registration-camera-switch" aria-label="Switch front or rear camera" title="Switch camera" hidden disabled>
            <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
          </button>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);

    cameraDialog = {
      overlay,
      video: overlay.querySelector("video"),
      help: overlay.querySelector(".registration-camera-help"),
      readyIndicator: overlay.querySelector(".registration-camera-ready"),
      readyText: overlay.querySelector(".registration-camera-ready-text"),
      deviceRow: overlay.querySelector(".registration-camera-source"),
      deviceSelect: overlay.querySelector(".registration-camera-select"),
      deviceStatus: overlay.querySelector(".registration-camera-source-status"),
      message: overlay.querySelector(".registration-camera-message"),
      closeButton: overlay.querySelector(".registration-camera-close"),
      cancelButton: overlay.querySelector(".registration-camera-cancel"),
      shutterButton: overlay.querySelector(".registration-camera-shutter"),
      switchButton: overlay.querySelector(".registration-camera-switch")
    };
    return cameraDialog;
  };

  const waitForCameraVideo = (video, signal = null) => {
    return new Promise((resolve, reject) => {
      let frameCallbackId = 0;
      let settled = false;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const timer = window.setTimeout(() => {
        finish(new Error("Matagal mag-load ang camera. Subukan ulit."));
      }, 10000);
      const handleAbort = () => {
        const error = new Error("Kinansela ang pagbukas ng camera.");
        error.name = "AbortError";
        finish(error);
      };
      const handleReady = () => {
        const hasCurrentFrame = video.videoWidth > 0
          && video.videoHeight > 0
          && Number(video.readyState || 0) >= 2;
        if (!hasCurrentFrame) return;
        if (typeof video.requestVideoFrameCallback === "function") {
          if (!frameCallbackId) {
            frameCallbackId = video.requestVideoFrameCallback(() => {
              frameCallbackId = 0;
              finish();
            });
          }
          return;
        }
        finish();
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        if (frameCallbackId && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(frameCallbackId);
          frameCallbackId = 0;
        }
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("playing", handleReady);
        if (signal) signal.removeEventListener("abort", handleAbort);
      };
      if (signal?.aborted) {
        handleAbort();
        return;
      }
      if (signal) signal.addEventListener("abort", handleAbort, { once: true });
      video.addEventListener("loadeddata", handleReady);
      video.addEventListener("canplay", handleReady);
      video.addEventListener("playing", handleReady);
      handleReady();
    });
  };

  const canvasToCameraFile = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Hindi makuha ang larawan mula sa camera."));
        return;
      }
      resolve(new File([blob], `camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now()
      }));
    }, "image/jpeg", 0.92);
  });

  const captureWithBrowserCamera = async () => {
    if (!window.isSecureContext) {
      throw new Error("Buksan ang page gamit ang HTTPS o http://localhost para gumana ang camera.");
    }
    if (!window.navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Hindi suportado ng browser na ito ang direct camera capture.");
    }
    if (activeCameraCancel) {
      throw new Error("May nakabukas nang camera.");
    }

    const ui = getCameraDialog();
    const isMobileCamera = isLikelyMobileDevice();
    ui.help.textContent = isMobileCamera
      ? "I-center nang malinaw bago kumuha ng larawan."
      : "Binubuksan ang laptop camera...";
    ui.help.classList.remove("is-privacy-hint");
    ui.overlay.classList.toggle("is-desktop-camera", !isMobileCamera);
    ui.overlay.classList.toggle("is-mobile-camera", isMobileCamera);
    ui.overlay.classList.remove("is-camera-mirrored");
    ui.readyIndicator.hidden = true;
    ui.deviceRow.hidden = true;
    ui.deviceSelect.disabled = true;
    ui.deviceStatus.textContent = "";
    ui.switchButton.hidden = true;
    ui.switchButton.disabled = true;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let stream = null;
    let videoTrack = null;
    let activeDeviceId = "";
    let activeFacingMode = "";
    let readyAbortController = null;
    let cameraReady = false;
    let startupComplete = false;
    let muteNoticeTimer = 0;
    let streamGeneration = 0;
    let switchingCamera = false;
    let capturingPhoto = false;
    let mobileCameraDevices = [];
    let settled = false;
    let resolveResult;
    let rejectResult;
    const resultPromise = new Promise((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const setReadyIndicator = (ready) => {
      const shouldShow = Boolean(ready && !isMobileCamera && videoTrack && !videoTrack.muted);
      ui.readyIndicator.hidden = !shouldShow;
      if (shouldShow) {
        ui.readyText.textContent = `${getCameraDisplayLabel(videoTrack.label, "PC Camera")} Ready`;
      }
    };

    const updatePreviewMirror = () => {
      const facingMode = String(videoTrack?.getSettings?.().facingMode || activeFacingMode || "").toLowerCase();
      const shouldMirror = facingMode ? facingMode === "user" : !isMobileCamera;
      ui.overlay.classList.toggle("is-camera-mirrored", Boolean(videoTrack && shouldMirror));
    };

    const updateMobileSwitchLabel = () => {
      if (!isMobileCamera) return;
      const targetLabel = activeFacingMode === "user" ? "rear" : "front";
      const actionLabel = `Lumipat sa ${targetLabel} camera`;
      ui.switchButton.setAttribute("aria-label", actionLabel);
      ui.switchButton.title = actionLabel;
    };

    const syncCameraControls = () => {
      const ready = Boolean(startupComplete && cameraReady && videoTrack && !videoTrack.muted);
      const idle = !switchingCamera && !capturingPhoto;
      ui.shutterButton.disabled = !ready || !idle;
      if (isMobileCamera) {
        ui.switchButton.disabled = ui.switchButton.hidden || !ready || !idle;
      } else {
        ui.deviceSelect.disabled = ui.deviceRow.hidden || !ready || !idle;
      }
    };

    const refreshMobileCameraState = () => {
      if (!isMobileCamera) return;
      const settingsFacingMode = String(videoTrack?.getSettings?.().facingMode || "").toLowerCase();
      const activeDevice = mobileCameraDevices.find((device) => device.deviceId === getCurrentDeviceId());
      const labelFacingMode = getMobileCameraFacingMode(activeDevice);
      if (settingsFacingMode === "user" || settingsFacingMode === "environment") {
        activeFacingMode = settingsFacingMode;
      } else if (labelFacingMode) {
        activeFacingMode = labelFacingMode;
      }

      const knownFacingModes = new Set(
        mobileCameraDevices.map((device) => getMobileCameraFacingMode(device)).filter(Boolean)
      );
      const hasUnknownCamera = mobileCameraDevices.some((device) => !getMobileCameraFacingMode(device));
      const hasFrontAndRear = knownFacingModes.has("user") && knownFacingModes.has("environment");
      const hasCameraChoices = hasFrontAndRear
        || (mobileCameraDevices.length >= 2 && hasUnknownCamera);
      ui.switchButton.hidden = !hasCameraChoices;
      updatePreviewMirror();
      updateMobileSwitchLabel();
      syncCameraControls();
    };

    const detachTrackListeners = () => {
      if (!videoTrack) return;
      videoTrack.removeEventListener("ended", handleTrackEnded);
      videoTrack.removeEventListener("mute", handleTrackMuted);
      videoTrack.removeEventListener("unmute", handleTrackUnmuted);
    };

    const releaseCurrentStream = () => {
      window.clearTimeout(muteNoticeTimer);
      muteNoticeTimer = 0;
      if (readyAbortController) readyAbortController.abort();
      readyAbortController = null;
      detachTrackListeners();
      videoTrack = null;
      activeDeviceId = "";
      activeFacingMode = "";
      stopCameraStream(stream);
      stream = null;
      cameraReady = false;
      setReadyIndicator(false);
      ui.overlay.classList.remove("is-camera-mirrored");
      syncCameraControls();
      try {
        ui.video.pause();
      } catch {
        // Ignore browsers that have already released the video element.
      }
      ui.video.srcObject = null;
    };

    const closeCamera = ({ file = null, error = null } = {}) => {
      if (settled) return;
      settled = true;
      streamGeneration += 1;
      window.navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      ui.deviceSelect.onchange = null;
      ui.switchButton.onclick = null;
      ui.closeButton.onclick = null;
      ui.cancelButton.onclick = null;
      ui.shutterButton.onclick = null;
      releaseCurrentStream();
      ui.overlay.hidden = true;
      ui.deviceRow.hidden = true;
      ui.shutterButton.disabled = true;
      ui.switchButton.hidden = true;
      ui.switchButton.disabled = true;
      document.body.classList.remove("registration-camera-open");
      activeCameraCancel = null;
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
      if (error) rejectResult(error);
      else resolveResult(file);
    };

    const handleTrackEnded = () => {
      closeCamera({ error: new Error("Nawala ang koneksyon sa camera. Ikabit o i-enable ito, pagkatapos ay subukan ulit.") });
    };

    const handleTrackMuted = () => {
      window.clearTimeout(muteNoticeTimer);
      muteNoticeTimer = window.setTimeout(() => {
        if (settled || !videoTrack?.muted) return;
        ui.message.textContent = "Walang video mula sa camera. Pumili ng ibang camera o i-enable ito.";
        ui.message.hidden = false;
        syncCameraControls();
        setReadyIndicator(false);
      }, 900);
    };

    const handleTrackUnmuted = () => {
      window.clearTimeout(muteNoticeTimer);
      muteNoticeTimer = 0;
      if (settled || !cameraReady || !startupComplete) return;
      syncCameraControls();
      if (switchingCamera || capturingPhoto) return;
      ui.message.hidden = true;
      setReadyIndicator(true);
    };

    const attachTrackListeners = () => {
      if (!videoTrack) return;
      videoTrack.addEventListener("ended", handleTrackEnded, { once: true });
      videoTrack.addEventListener("mute", handleTrackMuted);
      videoTrack.addEventListener("unmute", handleTrackUnmuted);
      if (videoTrack.muted) handleTrackMuted();
    };

    const getCurrentDeviceId = () => String(videoTrack?.getSettings?.().deviceId || activeDeviceId || "");

    const populateCameraOptions = async (knownDevices = null) => {
      if (settled) return [];
      const listedDevices = Array.isArray(knownDevices)
        ? knownDevices
        : await (isMobileCamera ? listAllVideoInputDevices() : listVideoInputDevices());
      const devices = listedDevices.filter((device) => (
        device?.deviceId && (isMobileCamera || !isExcludedCameraDevice(device))
      ));
      if (settled) return [];
      if (isMobileCamera) {
        mobileCameraDevices = devices;
        ui.deviceRow.hidden = true;
        refreshMobileCameraState();
        return devices;
      }
      const currentDeviceId = getCurrentDeviceId();
      const fragment = document.createDocumentFragment();
      const baseLabels = devices.map((device, index) => getCameraDisplayLabel(device.label, `Camera ${index + 1}`));
      const labelCounts = baseLabels.reduce((counts, label) => {
        counts.set(label, (counts.get(label) || 0) + 1);
        return counts;
      }, new Map());
      const labelIndexes = new Map();
      devices.forEach((device, index) => {
        const option = document.createElement("option");
        const baseLabel = baseLabels[index];
        const labelIndex = (labelIndexes.get(baseLabel) || 0) + 1;
        labelIndexes.set(baseLabel, labelIndex);
        option.value = device.deviceId;
        option.textContent = labelCounts.get(baseLabel) > 1 ? `${baseLabel} ${labelIndex}` : baseLabel;
        option.selected = device.deviceId === currentDeviceId;
        fragment.appendChild(option);
      });
      ui.deviceSelect.replaceChildren(fragment);
      const hasCameraChoices = devices.length >= 2;
      ui.deviceRow.hidden = !hasCameraChoices;
      syncCameraControls();
      if (currentDeviceId && devices.some((device) => device.deviceId === currentDeviceId)) {
        ui.deviceSelect.value = currentDeviceId;
      }
      ui.help.textContent = "I-center nang malinaw bago kumuha ng larawan.";
      ui.help.classList.remove("is-privacy-hint");
      return devices;
    };

    const activateCamera = async (nextStream, generation, requestedDeviceId = "", requestedFacingMode = "") => {
      if (settled || generation !== streamGeneration) {
        stopCameraStream(nextStream);
        return false;
      }
      stream = nextStream;
      videoTrack = stream.getVideoTracks()[0] || null;
      const trackSettings = videoTrack?.getSettings?.() || {};
      activeDeviceId = String(trackSettings.deviceId || requestedDeviceId || "");
      activeFacingMode = String(trackSettings.facingMode || requestedFacingMode || "").toLowerCase();
      updatePreviewMirror();
      attachTrackListeners();
      ui.video.srcObject = stream;
      readyAbortController = new AbortController();
      const signal = readyAbortController.signal;
      await ui.video.play();
      await waitForCameraVideo(ui.video, signal);
      if (settled || generation !== streamGeneration) {
        if (stream === nextStream) releaseCurrentStream();
        else stopCameraStream(nextStream);
        return false;
      }
      readyAbortController = null;
      cameraReady = true;
      if (isMobileCamera) refreshMobileCameraState();
      if (!videoTrack?.muted && startupComplete && !switchingCamera && !capturingPhoto) {
        ui.message.hidden = true;
        setReadyIndicator(true);
      }
      syncCameraControls();
      return true;
    };

    const openCameraDevice = async (deviceId = "", requestedFacingMode = "", strictFacingMode = false) => {
      if (settled) return false;
      const generation = ++streamGeneration;
      releaseCurrentStream();
      const nextStream = await requestCameraStream({
        deviceId,
        facingMode: requestedFacingMode,
        strictFacingMode
      });
      try {
        return await activateCamera(nextStream, generation, deviceId, requestedFacingMode);
      } catch (error) {
        if (generation === streamGeneration && stream === nextStream) releaseCurrentStream();
        else stopCameraStream(nextStream);
        throw error;
      }
    };

    const switchDesktopCamera = async (nextDeviceId) => {
      const requestedDeviceId = String(nextDeviceId || "");
      const previousDeviceId = getCurrentDeviceId();
      if (settled || switchingCamera || capturingPhoto || !requestedDeviceId || requestedDeviceId === previousDeviceId) return;
      const restoreSelectorFocus = document.activeElement === ui.deviceSelect;
      switchingCamera = true;
      setReadyIndicator(false);
      syncCameraControls();
      ui.message.textContent = "Lilipat ng camera...";
      ui.message.hidden = false;
      ui.deviceStatus.textContent = "Lilipat ng camera";
      try {
        const opened = await openCameraDevice(requestedDeviceId);
        if (!opened || settled) return;
        saveDesktopCameraId(requestedDeviceId);
        await populateCameraOptions();
        if (settled) return;
        ui.deviceStatus.textContent = "Napalitan ang camera";
      } catch (error) {
        let restored = false;
        if (!settled && previousDeviceId) {
          try {
            restored = await openCameraDevice(previousDeviceId);
          } catch {
            restored = false;
          }
        }
        if (!settled && !restored) {
          try {
            restored = await openCameraDevice();
          } catch {
            restored = false;
          }
        }
        if (!settled) {
          await populateCameraOptions();
          if (settled) return;
          ui.message.textContent = restored
            ? "Hindi mabuksan ang napiling camera; ibinalik ang dating camera."
            : getCameraErrorMessage(error);
          ui.message.hidden = false;
          ui.deviceStatus.textContent = ui.message.textContent;
        }
      } finally {
        switchingCamera = false;
        syncCameraControls();
        if (!settled && !ui.deviceRow.hidden) {
          if (restoreSelectorFocus) ui.deviceSelect.focus({ preventScroll: true });
        }
      }
    };

    const switchMobileCamera = async () => {
      if (!isMobileCamera || settled || switchingCamera || capturingPhoto
        || !startupComplete || !cameraReady || ui.switchButton.hidden) return;
      if (mobileCameraDevices.length < 2) {
        await populateCameraOptions();
        if (settled || mobileCameraDevices.length < 2 || ui.switchButton.hidden) return;
      }

      const previousDeviceId = getCurrentDeviceId();
      const previousFacingMode = activeFacingMode === "user" ? "user" : "environment";
      const nextFacingMode = previousFacingMode === "user" ? "environment" : "user";
      const nextDevice = mobileCameraDevices.find((device) => (
        device.deviceId !== previousDeviceId
        && getMobileCameraFacingMode(device) === nextFacingMode
      ));

      const restoreSwitchFocus = document.activeElement === ui.switchButton;
      switchingCamera = true;
      syncCameraControls();
      ui.message.textContent = "Lilipat ng camera...";
      ui.message.hidden = false;

      try {
        const opened = await openCameraDevice(nextDevice?.deviceId || "", nextFacingMode, !nextDevice);
        if (!opened || settled) return;
        await populateCameraOptions();
        if (settled) return;
        ui.message.hidden = true;
      } catch (error) {
        let restored = false;
        if (!settled && previousDeviceId) {
          try {
            restored = await openCameraDevice(previousDeviceId, previousFacingMode);
          } catch {
            restored = false;
          }
        }
        if (!settled && !restored) {
          try {
            restored = await openCameraDevice("", previousFacingMode, true);
          } catch {
            restored = false;
          }
        }
        if (!settled) {
          await populateCameraOptions();
          if (settled) return;
          ui.message.textContent = restored
            ? "Hindi mabuksan ang napiling camera; ibinalik ang dating camera."
            : getCameraErrorMessage(error);
          ui.message.hidden = false;
        }
      } finally {
        switchingCamera = false;
        syncCameraControls();
        if (!settled && !ui.switchButton.hidden) {
          if (restoreSwitchFocus) ui.switchButton.focus({ preventScroll: true });
        }
      }
    };

    const handleDeviceChange = () => {
      if (!settled && !switchingCamera) void populateCameraOptions();
    };

    const cancelCamera = () => closeCamera();
    activeCameraCancel = cancelCamera;
    ui.closeButton.onclick = cancelCamera;
    ui.cancelButton.onclick = cancelCamera;
    ui.deviceSelect.onchange = () => void switchDesktopCamera(ui.deviceSelect.value);
    ui.switchButton.onclick = () => void switchMobileCamera();
    ui.shutterButton.onclick = async () => {
      if (capturingPhoto || switchingCamera) return;
      const width = Number(ui.video.videoWidth || 0);
      const height = Number(ui.video.videoHeight || 0);
      if (!cameraReady || !width || !height) {
        ui.message.textContent = "Hindi pa handa ang camera. Sandali lang.";
        ui.message.hidden = false;
        return;
      }

      capturingPhoto = true;
      syncCameraControls();
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Hindi makuha ng device ang larawan.");
        context.drawImage(ui.video, 0, 0, width, height);
        const file = await canvasToCameraFile(canvas);
        closeCamera({ file });
      } catch (error) {
        if (settled) return;
        capturingPhoto = false;
        ui.message.textContent = getCameraErrorMessage(error);
        ui.message.hidden = false;
        syncCameraControls();
      }
    };

    ui.message.textContent = "Binubuksan ang camera...";
    ui.message.hidden = false;
    ui.shutterButton.disabled = true;
    ui.overlay.hidden = false;
    document.body.classList.add("registration-camera-open");
    ui.closeButton.focus({ preventScroll: true });

    try {
      let initialDeviceId = "";
      let savedDesktopCameraId = "";
      if (!isMobileCamera) {
        savedDesktopCameraId = getSavedDesktopCameraId();
        initialDeviceId = savedDesktopCameraId;
      }

      try {
        await openCameraDevice(initialDeviceId, isMobileCamera ? "environment" : "");
      } catch (error) {
        if (!initialDeviceId || settled) throw error;
        saveDesktopCameraId("");
        savedDesktopCameraId = "";
        await openCameraDevice();
      }

      let availableDevices = await populateCameraOptions();
      if (!settled && !isMobileCamera && availableDevices.length > 0) {
        const currentDeviceId = getCurrentDeviceId();
        const currentDevice = availableDevices.find((device) => device.deviceId === currentDeviceId);
        const preferredDevice = findPreferredDesktopCamera(availableDevices);
        const currentCameraIsExcluded = isExcludedCameraDevice(videoTrack);
        const shouldAutoSwitch = preferredDevice
          && preferredDevice.deviceId !== currentDeviceId
          && (currentCameraIsExcluded
            || !currentDevice
            || (!savedDesktopCameraId && getCameraDeviceScore(preferredDevice) >= 100)
            || getCameraDeviceScore(currentDevice) < 0);
        if (shouldAutoSwitch) {
          ui.message.textContent = "Pinipili ang PC Camera...";
          ui.message.hidden = false;
          await switchDesktopCamera(preferredDevice.deviceId);
        }
      }

      if (!settled && !isMobileCamera && isExcludedCameraDevice(videoTrack)) {
        saveDesktopCameraId("");
        throw new Error("Walang available na physical PC Camera o USB webcam.");
      }

      if (!settled) {
        startupComplete = true;
        if (!isMobileCamera) {
          const currentDeviceId = getCurrentDeviceId();
          const currentDevice = availableDevices.find((device) => device.deviceId === currentDeviceId);
          if (currentDevice && (savedDesktopCameraId || getCameraDeviceScore(currentDevice) > 0)) {
            saveDesktopCameraId(currentDeviceId);
          } else if (isExcludedCameraDevice(videoTrack)) {
            saveDesktopCameraId("");
          }
        }
        window.navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
        syncCameraControls();
        if (cameraReady && !videoTrack?.muted) {
          ui.message.hidden = true;
          setReadyIndicator(true);
        }
        if (document.activeElement === ui.closeButton && !ui.shutterButton.disabled) {
          ui.shutterButton.focus({ preventScroll: true });
        }
      }
    } catch (error) {
      if (!settled) closeCamera({ error: new Error(getCameraErrorMessage(error)) });
    }

    return resultPromise;
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeCameraCancel) {
      event.preventDefault();
      activeCameraCancel();
      return;
    }
    if (event.key === "Tab" && activeCameraCancel && cameraDialog && !cameraDialog.overlay.hidden) {
      const focusable = [
        cameraDialog.closeButton,
        cameraDialog.deviceRow && !cameraDialog.deviceRow.hidden ? cameraDialog.deviceSelect : null,
        cameraDialog.cancelButton,
        cameraDialog.shutterButton,
        cameraDialog.switchButton && !cameraDialog.switchButton.hidden ? cameraDialog.switchButton : null
      ].filter((element) => element && !element.disabled && !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !focusable.includes(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !focusable.includes(current))) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("pagehide", () => {
    if (activeCameraCancel) activeCameraCancel();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activeCameraCancel) activeCameraCancel();
  });

  const dataUrlByteLength = (dataUrl) => {
    const commaIndex = String(dataUrl || "").indexOf(",");
    if (commaIndex < 0) return 0;
    const base64 = String(dataUrl).slice(commaIndex + 1).replace(/\s/g, "");
    const padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0);
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const dataUrlToBlob = (dataUrl) => {
    const value = String(dataUrl || "");
    const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      throw new Error("Invalid processed photo data.");
    }
    const binary = window.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: match[1] });
  };

  const loadImage = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Hindi mabasa ang nakuhang larawan."));
    };
    image.src = objectUrl;
  });

  const compressImage = async (file, options = {}) => {
    if (!(file instanceof File) || !String(file.type || "").toLowerCase().startsWith("image/")) {
      throw new Error("Kumuha ng valid na larawan gamit ang camera.");
    }
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      throw new Error("Masyadong malaki ang nakuhang larawan. Kumuha ulit ng photo.");
    }

    const image = await loadImage(file);
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Walang valid na sukat ang nakuhang larawan.");
    }

    const maxWidth = Math.max(320, Number(options.maxWidth || 1280));
    const maxHeight = Math.max(320, Number(options.maxHeight || 1280));
    const maxOutputBytes = Math.max(120 * 1024, Number(options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES));
    const initialScale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    let quality = Math.min(0.88, Math.max(0.62, Number(options.quality || 0.8)));
    let result = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("Hindi ma-process ng device ang larawan.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      result = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlByteLength(result) <= maxOutputBytes) {
        return result;
      }
      const retryScale = 0.82;
      width = Math.max(1, Math.round(width * retryScale));
      height = Math.max(1, Math.round(height * retryScale));
      quality = Math.max(0.6, quality - 0.08);
    }

    if (!result || dataUrlByteLength(result) > maxOutputBytes) {
      throw new Error("Hindi mapaliit ang larawan. Kumuha ulit ng photo.");
    }
    return result;
  };

  const create = (options = {}) => {
    const fileInput = options.fileInput || null;
    const triggerButton = options.triggerButton || null;
    const previewImage = options.previewImage || null;
    const placeholder = options.placeholder || null;
    const removeButton = options.removeButton || null;
    const triggerText = options.triggerText || null;
    const status = options.status || null;
    const emptyLabel = String(options.emptyLabel || "Open Camera");
    const filledLabel = String(options.filledLabel || "Retake");
    const emptyStatus = String(options.emptyStatus || status?.textContent || "No photo yet").trim();
    let value = "";
    let processingToken = 0;
    let processing = false;
    let cameraActive = false;

    const setStatus = (message = "", tone = "muted") => {
      if (!status) return;
      status.textContent = String(message || "");
      status.classList.remove("text-muted", "text-success", "text-danger");
      status.classList.add(tone === "danger" ? "text-danger" : (tone === "success" ? "text-success" : "text-muted"));
    };

    const setControlsDisabled = (disabled) => {
      if (fileInput) fileInput.disabled = disabled;
      if (triggerButton) triggerButton.disabled = disabled;
      if (removeButton) removeButton.disabled = disabled;
    };

    const render = () => {
      const hasPhoto = value !== "";
      if (previewImage) {
        if (hasPhoto) {
          previewImage.src = value;
          previewImage.hidden = false;
        } else {
          previewImage.hidden = true;
          previewImage.removeAttribute("src");
        }
      }
      if (placeholder) placeholder.hidden = hasPhoto;
      if (removeButton) removeButton.hidden = !hasPhoto;
      if (triggerText) triggerText.textContent = hasPhoto ? filledLabel : emptyLabel;
      if (triggerButton) {
        triggerButton.classList.toggle("btn-primary", !hasPhoto);
        triggerButton.classList.toggle("btn-outline-primary", hasPhoto);
      }
    };

    const setValue = async (nextValue, { notify = false } = {}) => {
      value = String(nextValue || "").trim();
      render();
      if (notify && typeof options.onChange === "function") {
        await options.onChange(value);
      }
    };

    if (previewImage) {
      previewImage.addEventListener("error", () => {
        previewImage.hidden = true;
        if (placeholder) placeholder.hidden = false;
        setStatus("Hindi ma-preview ang larawan.", "danger");
      });
      previewImage.addEventListener("load", () => {
        if (value) setStatus("Ready", "success");
      });
    }

    const processCameraFile = async (file) => {
      if (!(file instanceof File)) return;
      const token = ++processingToken;
      const previousValue = value;
      processing = true;
      setControlsDisabled(true);
      setStatus("Processing...", "muted");
      try {
        const dataUrl = await compressImage(file, options);
        if (token !== processingToken) return;
        await setValue(dataUrl, { notify: true });
        setStatus("Ready", "success");
      } catch (error) {
        await setValue(previousValue);
        const message = error instanceof Error ? error.message : "Hindi ma-process ang larawan.";
        setStatus(message, "danger");
      } finally {
        if (token === processingToken) {
          processing = false;
          if (fileInput) fileInput.value = "";
          if (!cameraActive) setControlsDisabled(false);
        }
      }
    };

    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (file) void processCameraFile(file);
      });
    }

    if (triggerButton) {
      triggerButton.addEventListener("click", async () => {
        if (processing || cameraActive) return;

        const nativeAppVersion = getNativeCameraAppVersion();
        if (nativeAppVersion >= MIN_NATIVE_CAMERA_APP_VERSION && fileInput) {
          fileInput.value = "";
          fileInput.click();
          return;
        }
        if (nativeAppVersion > 0) {
          setStatus("Luma ang installed app. I-install ang signed v5 para direktang mabuksan ang camera.", "danger");
          return;
        }

        const previousStatus = String(status?.textContent || emptyStatus);
        const previousTone = status?.classList.contains("text-success")
          ? "success"
          : (status?.classList.contains("text-danger") ? "danger" : "muted");
        cameraActive = true;
        setControlsDisabled(true);
        setStatus("Processing...", "muted");
        try {
          const file = await captureWithBrowserCamera();
          if (!file) {
            setStatus(previousStatus, previousTone);
            return;
          }
          await processCameraFile(file);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Hindi mabuksan ang camera.";
          setStatus(message, "danger");
        } finally {
          cameraActive = false;
          if (!processing) setControlsDisabled(false);
          if (triggerButton && !triggerButton.disabled) {
            triggerButton.focus({ preventScroll: true });
          }
        }
      });
    }

    if (removeButton) {
      removeButton.addEventListener("click", async () => {
        processingToken += 1;
        processing = true;
        setControlsDisabled(true);
        if (fileInput) fileInput.value = "";
        const previousValue = value;
        try {
          await setValue("", { notify: true });
          setStatus(emptyStatus, "muted");
        } catch (error) {
          await setValue(previousValue);
          const message = error instanceof Error ? error.message : "Hindi maalis ang larawan.";
          setStatus(message, "danger");
        } finally {
          processing = false;
          if (!cameraActive) setControlsDisabled(false);
        }
      });
    }

    void setValue(options.initialValue || "");

    return {
      getValue: () => value,
      setValue,
      isProcessing: () => processing || cameraActive
    };
  };

  window.HouseholdPhotoCapture = {
    create,
    compressImage,
    dataUrlByteLength,
    dataUrlToBlob
  };
})();
