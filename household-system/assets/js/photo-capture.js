(function () {
  "use strict";

  const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  const DEFAULT_MAX_OUTPUT_BYTES = 900 * 1024;
  const MIN_NATIVE_CAMERA_APP_VERSION = 6;
  const CAMERA_REQUEST_TIMEOUT_MS = 30000;
  // Versioned so an older saved phone/virtual-camera choice is not reopened.
  const DESKTOP_CAMERA_STORAGE_KEY = "cabarianPreferredPhysicalCameraV2";
  let cameraDialog = null;
  let photoPreviewDialog = null;
  let photoDeleteDialog = null;
  let activeCameraCancel = null;
  let activeCameraReadyForVisibilityCancel = false;

  const getBootstrapModal = (element) => {
    const Modal = window.bootstrap?.Modal;
    if (!element || typeof Modal !== "function") return null;
    return typeof Modal.getOrCreateInstance === "function"
      ? Modal.getOrCreateInstance(element)
      : new Modal(element);
  };

  const getPhotoPreviewDialog = () => {
    if (photoPreviewDialog) return photoPreviewDialog;

    const element = document.createElement("div");
    element.className = "modal fade registration-photo-view-modal";
    element.id = "registrationPhotoViewModal";
    element.tabIndex = -1;
    element.setAttribute("aria-labelledby", "registrationPhotoViewTitle");
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content modern-modal registration-photo-view-content">
          <div class="modal-header registration-photo-view-header">
            <h5 class="modal-title" id="registrationPhotoViewTitle">Photo Preview</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close photo preview"></button>
          </div>
          <div class="modal-body registration-photo-view-body">
            <img class="registration-photo-view-image" alt="Captured photo preview">
          </div>
          <div class="modal-footer registration-photo-view-footer">
            <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(element);

    const modal = getBootstrapModal(element);
    photoPreviewDialog = {
      element,
      modal,
      image: element.querySelector(".registration-photo-view-image"),
      title: element.querySelector(".modal-title"),
      returnFocus: null
    };
    element.addEventListener("hidden.bs.modal", () => {
      const ui = photoPreviewDialog;
      if (!ui) return;
      ui.image.removeAttribute("src");
      const returnFocus = ui.returnFocus;
      ui.returnFocus = null;
      if (returnFocus instanceof HTMLElement && document.contains(returnFocus) && !returnFocus.hidden) {
        returnFocus.focus({ preventScroll: true });
      }
    });
    return photoPreviewDialog;
  };

  const openPhotoPreview = ({ source = "", title = "Photo Preview", alt = "Captured photo", trigger = null } = {}) => {
    const photoSource = String(source || "").trim();
    if (!photoSource) return;
    const ui = getPhotoPreviewDialog();
    if (!ui?.modal || !ui.image) return;
    ui.title.textContent = String(title || "Photo Preview");
    ui.image.alt = String(alt || "Captured photo");
    ui.image.src = photoSource;
    ui.returnFocus = trigger instanceof HTMLElement ? trigger : null;
    ui.modal.show();
  };

  const getPhotoDeleteDialog = () => {
    if (photoDeleteDialog) return photoDeleteDialog;

    const element = document.createElement("div");
    element.className = "modal fade registration-photo-delete-modal";
    element.id = "registrationPhotoDeleteModal";
    element.tabIndex = -1;
    element.setAttribute("aria-labelledby", "registrationPhotoDeleteTitle");
    element.setAttribute("aria-describedby", "registrationPhotoDeleteMessage");
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content modern-modal registration-photo-delete-content text-center">
          <div class="modal-icon mb-3 text-danger">
            <i class="bi bi-trash-fill fs-1" aria-hidden="true"></i>
          </div>
          <h5 class="modal-title mb-2" id="registrationPhotoDeleteTitle">Remove Photo</h5>
          <div class="registration-photo-delete-preview" hidden>
            <img alt="Photo selected for removal">
          </div>
          <p class="mb-3" id="registrationPhotoDeleteMessage">Are you sure you want to remove this photo?</p>
          <div class="d-flex justify-content-center gap-2 flex-wrap">
            <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger btn-modern registration-photo-delete-confirm">Remove</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(element);

    const modal = getBootstrapModal(element);
    photoDeleteDialog = {
      element,
      modal,
      title: element.querySelector(".modal-title"),
      message: element.querySelector("#registrationPhotoDeleteMessage"),
      preview: element.querySelector(".registration-photo-delete-preview"),
      image: element.querySelector(".registration-photo-delete-preview img"),
      cancelButton: element.querySelector('[data-bs-dismiss="modal"]'),
      confirmButton: element.querySelector(".registration-photo-delete-confirm"),
      approved: false,
      resolve: null
    };
    photoDeleteDialog.confirmButton.addEventListener("click", () => {
      if (!photoDeleteDialog?.resolve) return;
      photoDeleteDialog.approved = true;
      photoDeleteDialog.modal.hide();
    });
    photoDeleteDialog.image.addEventListener("error", () => {
      if (!photoDeleteDialog) return;
      photoDeleteDialog.image.removeAttribute("src");
      photoDeleteDialog.preview.hidden = true;
    });
    element.addEventListener("shown.bs.modal", () => {
      photoDeleteDialog?.cancelButton?.focus({ preventScroll: true });
    });
    element.addEventListener("hidden.bs.modal", () => {
      const ui = photoDeleteDialog;
      if (!ui) return;
      const resolve = ui.resolve;
      const approved = ui.approved;
      ui.resolve = null;
      ui.approved = false;
      ui.image.removeAttribute("src");
      ui.preview.hidden = true;
      if (resolve) resolve(approved);
    });
    return photoDeleteDialog;
  };

  const confirmPhotoRemoval = ({
    source = "",
    title = "Remove Photo",
    message = "Are you sure you want to remove this photo? This action cannot be undone."
  } = {}) => {
    const promptMessage = String(message || "").trim() || "Are you sure you want to remove this photo?";
    const ui = getPhotoDeleteDialog();
    if (!ui?.modal || !ui.confirmButton) {
      return Promise.resolve(window.confirm(promptMessage));
    }
    if (ui.resolve) return Promise.resolve(false);

    ui.title.textContent = String(title || "Remove Photo");
    ui.message.textContent = promptMessage;
    const photoSource = String(source || "").trim();
    if (photoSource) {
      ui.image.src = photoSource;
      ui.preview.hidden = false;
    } else {
      ui.image.removeAttribute("src");
      ui.preview.hidden = true;
    }
    ui.approved = false;
    return new Promise((resolve) => {
      ui.resolve = resolve;
      try {
        ui.modal.show();
      } catch {
        ui.resolve = null;
        ui.image.removeAttribute("src");
        ui.preview.hidden = true;
        resolve(window.confirm(promptMessage));
      }
    });
  };

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

  const requestUserMediaWithTimeout = (constraints, timeoutMs = CAMERA_REQUEST_TIMEOUT_MS) => {
    const mediaDevices = window.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      return Promise.reject(new Error("Direct camera capture is not supported by this browser."));
    }

    let timedOut = false;
    let timer = 0;
    let request;
    try {
      request = mediaDevices.getUserMedia(constraints);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then((stream) => {
      if (timedOut) stopCameraStream(stream);
    }, () => {
      // The race below reports the camera error.
    });

    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => {
        timedOut = true;
        const error = new Error("The camera is taking too long to respond. Tap Allow Camera or use Phone Camera.");
        error.name = "TimeoutError";
        reject(error);
      }, Math.max(1000, Number(timeoutMs) || CAMERA_REQUEST_TIMEOUT_MS));
    });

    return Promise.race([request, timeout]).finally(() => {
      window.clearTimeout(timer);
    });
  };

  const getCameraErrorMessage = (error) => {
    const name = String(error?.name || "");
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Camera access is blocked. Tap Allow Camera. If no prompt appears, enable Camera in your phone's app settings.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "The camera could not be opened. Close any other app or tab using it, then try again.";
    }
    if (name === "SecurityError") {
      return "Camera access was blocked by the browser. Use HTTPS or http://localhost.";
    }
    if (name === "AbortError") {
      return "Camera startup was interrupted. Try again.";
    }
    if (name === "TimeoutError") {
      return "The camera is taking too long to respond. Tap Allow Camera or use Phone Camera.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "The selected camera setting is unavailable. Try again.";
    }
    if (error instanceof Error && error.message) return error.message;
    return "The camera could not be opened on this device.";
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
      return requestUserMediaWithTimeout({ audio: false, video });
    }

    if (deviceId) {
      return requestUserMediaWithTimeout({
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
      return await requestUserMediaWithTimeout({
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
      return requestUserMediaWithTimeout({ audio: false, video: true });
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
            <small class="registration-camera-help" id="registrationCameraHelp">Position the resident's face and upper chest inside the guide.</small>
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
          <img class="registration-camera-review" alt="Captured photo preview" hidden>
          <div class="registration-camera-frame-guide" aria-hidden="true"></div>
          <div class="registration-camera-message" role="status" aria-live="polite">Opening camera...</div>
        </div>
        <footer class="registration-camera-actions">
          <button type="button" class="btn btn-outline-light registration-camera-cancel">Cancel</button>
          <button type="button" class="btn btn-primary registration-camera-shutter" aria-label="Capture photo" title="Capture photo" disabled>
            <i class="bi bi-camera-fill" aria-hidden="true"></i>
            <span class="registration-camera-shutter-label">Capture Photo</span>
          </button>
          <button type="button" class="btn btn-light registration-camera-native-fallback" hidden>
            <i class="bi bi-phone" aria-hidden="true"></i>
            <span>Use Phone Camera</span>
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
      title: overlay.querySelector("#registrationCameraTitle"),
      video: overlay.querySelector("video"),
      reviewImage: overlay.querySelector(".registration-camera-review"),
      frameGuide: overlay.querySelector(".registration-camera-frame-guide"),
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
      shutterLabel: overlay.querySelector(".registration-camera-shutter-label"),
      nativeFallbackButton: overlay.querySelector(".registration-camera-native-fallback"),
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
        finish(new Error("The camera took too long to load. Try again."));
      }, 10000);
      const handleAbort = () => {
        const error = new Error("Camera startup was canceled.");
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
        reject(new Error("Unable to capture a photo from the camera."));
        return;
      }
      resolve(new File([blob], `camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now()
      }));
    }, "image/jpeg", 0.92);
  });

  const captureWithBrowserCamera = async (options = {}) => {
    if (!window.isSecureContext) {
      throw new Error("Open this page over HTTPS or http://localhost to use the camera.");
    }
    if (!window.navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Direct camera capture is not supported by this browser.");
    }
    if (activeCameraCancel) {
      throw new Error("The camera is already open.");
    }

    const ui = getCameraDialog();
    const isMobileCamera = isLikelyMobileDevice();
    const onNativeFallback = typeof options.onNativeFallback === "function"
      ? options.onNativeFallback
      : null;
    const defaultHelp = isMobileCamera
      ? "Position the resident's face and upper chest inside the guide."
      : "Center the resident clearly before taking the photo.";
    ui.title.textContent = "Camera";
    ui.help.textContent = defaultHelp;
    ui.help.classList.remove("is-privacy-hint");
    ui.overlay.classList.toggle("is-desktop-camera", !isMobileCamera);
    ui.overlay.classList.toggle("is-mobile-camera", isMobileCamera);
    ui.overlay.classList.remove("is-camera-mirrored", "is-reviewing", "has-camera-error");
    ui.reviewImage.hidden = true;
    ui.reviewImage.removeAttribute("src");
    ui.readyIndicator.hidden = true;
    ui.deviceRow.hidden = true;
    ui.deviceSelect.disabled = true;
    ui.deviceStatus.textContent = "";
    ui.cancelButton.textContent = "Cancel";
    ui.shutterButton.hidden = false;
    ui.shutterButton.setAttribute("aria-label", "Capture photo");
    ui.shutterButton.title = "Capture photo";
    ui.shutterLabel.textContent = "Capture Photo";
    ui.nativeFallbackButton.hidden = true;
    ui.switchButton.hidden = true;
    ui.switchButton.disabled = true;
    activeCameraReadyForVisibilityCancel = false;

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
    let reviewFile = null;
    let reviewObjectUrl = "";
    let mobileCameraDevices = [];
    let cameraStartupRunning = false;
    let retryCameraAccess = null;
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
      const actionLabel = `Switch to the ${targetLabel} camera`;
      ui.switchButton.setAttribute("aria-label", actionLabel);
      ui.switchButton.title = actionLabel;
    };

    const syncCameraControls = () => {
      const reviewing = Boolean(reviewFile);
      const ready = reviewing || Boolean(startupComplete && cameraReady && videoTrack && !videoTrack.muted);
      const idle = !switchingCamera && !capturingPhoto;
      ui.shutterButton.disabled = !ready || !idle;
      if (isMobileCamera) {
        ui.switchButton.disabled = reviewing || ui.switchButton.hidden || !ready || !idle;
      } else {
        ui.deviceSelect.disabled = reviewing || ui.deviceRow.hidden || !ready || !idle;
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
      ui.switchButton.hidden = Boolean(reviewFile) || !hasCameraChoices;
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

    const clearReviewPhoto = () => {
      reviewFile = null;
      if (reviewObjectUrl) URL.revokeObjectURL(reviewObjectUrl);
      reviewObjectUrl = "";
      ui.reviewImage.hidden = true;
      ui.reviewImage.removeAttribute("src");
      ui.overlay.classList.remove("is-reviewing");
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
      ui.nativeFallbackButton.onclick = null;
      clearReviewPhoto();
      releaseCurrentStream();
      ui.overlay.hidden = true;
      ui.deviceRow.hidden = true;
      ui.shutterButton.disabled = true;
      ui.shutterButton.hidden = false;
      ui.nativeFallbackButton.hidden = true;
      ui.switchButton.hidden = true;
      ui.switchButton.disabled = true;
      ui.overlay.classList.remove("has-camera-error");
      document.body.classList.remove("registration-camera-open");
      activeCameraCancel = null;
      activeCameraReadyForVisibilityCancel = false;
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
      if (error) rejectResult(error);
      else resolveResult(file);
    };

    const handleTrackEnded = () => {
      closeCamera({ error: new Error("The camera connection was lost. Reconnect or enable it, then try again.") });
    };

    const handleTrackMuted = () => {
      window.clearTimeout(muteNoticeTimer);
      muteNoticeTimer = window.setTimeout(() => {
        if (settled || !videoTrack?.muted) return;
        ui.message.textContent = "No video is coming from the camera. Select another camera or enable it.";
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
      if (!reviewFile) ui.help.textContent = defaultHelp;
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
      ui.message.textContent = "Switching camera...";
      ui.message.hidden = false;
      ui.deviceStatus.textContent = "Switching camera";
      try {
        const opened = await openCameraDevice(requestedDeviceId);
        if (!opened || settled) return;
        saveDesktopCameraId(requestedDeviceId);
        await populateCameraOptions();
        if (settled) return;
        ui.deviceStatus.textContent = "Camera switched";
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
            ? "Unable to open the selected camera; the previous camera was restored."
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
      ui.message.textContent = "Switching camera...";
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
        if (!settled && !restored) {
          showNativeCameraFallback(error);
          return;
        }
        if (!settled) {
          await populateCameraOptions();
          if (settled) return;
          ui.message.textContent = restored
            ? "Unable to open the selected camera; the previous camera was restored."
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
    const leaveReviewMode = () => {
      if (!reviewFile || settled) return;
      clearReviewPhoto();
      ui.title.textContent = "Camera";
      ui.help.textContent = defaultHelp;
      ui.cancelButton.textContent = "Cancel";
      ui.shutterButton.setAttribute("aria-label", "Capture photo");
      ui.shutterButton.title = "Capture photo";
      ui.shutterLabel.textContent = "Capture Photo";
      if (isMobileCamera) refreshMobileCameraState();
      ui.message.hidden = Boolean(cameraReady && !videoTrack?.muted);
      syncCameraControls();
      if (!ui.shutterButton.disabled) ui.shutterButton.focus({ preventScroll: true });
    };

    const enterReviewMode = (file) => {
      clearReviewPhoto();
      reviewFile = file;
      reviewObjectUrl = URL.createObjectURL(file);
      ui.reviewImage.src = reviewObjectUrl;
      ui.reviewImage.hidden = false;
      ui.overlay.classList.add("is-reviewing");
      ui.title.textContent = "Review Photo";
      ui.help.textContent = "Make sure the face and upper chest are clear before using this photo.";
      ui.cancelButton.textContent = "Retake";
      ui.shutterButton.setAttribute("aria-label", "Use photo");
      ui.shutterButton.title = "Use photo";
      ui.shutterLabel.textContent = "Use Photo";
      ui.switchButton.hidden = true;
      ui.message.hidden = true;
      capturingPhoto = false;
      syncCameraControls();
      ui.shutterButton.focus({ preventScroll: true });
    };

    const showNativeCameraFallback = (error) => {
      if (settled || !isMobileCamera || !onNativeFallback) {
        if (!settled) closeCamera({ error: new Error(getCameraErrorMessage(error)) });
        return;
      }
      streamGeneration += 1;
      window.navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      releaseCurrentStream();
      startupComplete = false;
      activeCameraReadyForVisibilityCancel = false;
      ui.overlay.classList.add("has-camera-error");
      ui.title.textContent = "Camera Access";
      ui.help.textContent = "Tap Allow Camera and approve the phone prompt, or use your phone's camera app.";
      ui.message.textContent = getCameraErrorMessage(error);
      ui.message.hidden = false;
      ui.cancelButton.textContent = "Allow Camera";
      ui.shutterButton.hidden = true;
      ui.nativeFallbackButton.hidden = false;
      ui.switchButton.hidden = true;
      ui.cancelButton.focus({ preventScroll: true });
    };

    activeCameraCancel = cancelCamera;
    ui.closeButton.onclick = cancelCamera;
    ui.cancelButton.onclick = () => {
      if (cameraStartupRunning) return;
      if (ui.overlay.classList.contains("has-camera-error") && retryCameraAccess) {
        void retryCameraAccess();
      } else if (reviewFile) leaveReviewMode();
      else cancelCamera();
    };
    ui.nativeFallbackButton.onclick = () => {
      if (!onNativeFallback || settled) return;
      closeCamera();
      onNativeFallback();
    };
    ui.deviceSelect.onchange = () => void switchDesktopCamera(ui.deviceSelect.value);
    ui.switchButton.onclick = () => void switchMobileCamera();
    ui.shutterButton.onclick = async () => {
      if (capturingPhoto || switchingCamera) return;
      if (reviewFile) {
        const selectedFile = reviewFile;
        closeCamera({ file: selectedFile });
        return;
      }
      const width = Number(ui.video.videoWidth || 0);
      const height = Number(ui.video.videoHeight || 0);
      if (!cameraReady || !width || !height) {
        ui.message.textContent = "The camera is not ready yet. Please wait.";
        ui.message.hidden = false;
        return;
      }

      capturingPhoto = true;
      syncCameraControls();
      try {
        const canvas = document.createElement("canvas");
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = width;
        let sourceHeight = height;
        if (isMobileCamera) {
          const portraitAspectRatio = 3 / 4;
          const videoRect = ui.video.getBoundingClientRect();
          const guideRect = ui.frameGuide?.getBoundingClientRect?.();
          if (videoRect.width > 0 && videoRect.height > 0
              && guideRect?.width > 0 && guideRect?.height > 0) {
            const coverScale = Math.max(videoRect.width / width, videoRect.height / height);
            const renderedWidth = width * coverScale;
            const renderedHeight = height * coverScale;
            const renderedLeft = (videoRect.width - renderedWidth) / 2;
            const renderedTop = (videoRect.height - renderedHeight) / 2;
            sourceX = (guideRect.left - videoRect.left - renderedLeft) / coverScale;
            sourceY = (guideRect.top - videoRect.top - renderedTop) / coverScale;
            sourceWidth = guideRect.width / coverScale;
            sourceHeight = guideRect.height / coverScale;
          }
          if (sourceWidth / sourceHeight > portraitAspectRatio) {
            const adjustedWidth = sourceHeight * portraitAspectRatio;
            sourceX += (sourceWidth - adjustedWidth) / 2;
            sourceWidth = adjustedWidth;
          } else {
            const adjustedHeight = sourceWidth / portraitAspectRatio;
            sourceY += (sourceHeight - adjustedHeight) / 2;
            sourceHeight = adjustedHeight;
          }
          sourceX = Math.max(0, Math.min(width - sourceWidth, sourceX));
          sourceY = Math.max(0, Math.min(height - sourceHeight, sourceY));
          const outputHeight = Math.min(1200, Math.max(1, Math.round(sourceHeight)));
          canvas.height = outputHeight;
          canvas.width = Math.max(1, Math.round(outputHeight * portraitAspectRatio));
        } else {
          canvas.width = width;
          canvas.height = height;
        }
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This device could not capture the photo.");
        context.drawImage(
          ui.video,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
        const file = await canvasToCameraFile(canvas);
        if (!settled) enterReviewMode(file);
      } catch (error) {
        if (settled) return;
        capturingPhoto = false;
        ui.message.textContent = getCameraErrorMessage(error);
        ui.message.hidden = false;
        syncCameraControls();
      }
    };

    ui.message.textContent = "Opening camera...";
    ui.message.hidden = false;
    ui.shutterButton.disabled = true;
    ui.overlay.hidden = false;
    document.body.classList.add("registration-camera-open");
    ui.closeButton.focus({ preventScroll: true });

    const startCamera = async () => {
      if (settled || cameraStartupRunning) return;
      cameraStartupRunning = true;
      startupComplete = false;
      activeCameraReadyForVisibilityCancel = false;
      ui.overlay.classList.remove("has-camera-error");
      ui.title.textContent = "Camera";
      ui.help.textContent = defaultHelp;
      ui.cancelButton.textContent = "Cancel";
      ui.shutterButton.hidden = false;
      ui.shutterButton.disabled = true;
      ui.nativeFallbackButton.hidden = true;
      ui.switchButton.hidden = true;
      ui.message.textContent = "Opening camera...";
      ui.message.hidden = false;
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
            ui.message.textContent = "Selecting PC camera...";
            ui.message.hidden = false;
            await switchDesktopCamera(preferredDevice.deviceId);
          }
        }

        if (!settled && !isMobileCamera && isExcludedCameraDevice(videoTrack)) {
          saveDesktopCameraId("");
          throw new Error("No physical PC camera or USB webcam is available.");
        }

        if (!settled) {
          startupComplete = true;
          activeCameraReadyForVisibilityCancel = true;
          if (document.hidden) {
            cancelCamera();
            return;
          }
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
        if (!settled) showNativeCameraFallback(error);
      } finally {
        cameraStartupRunning = false;
      }
    };
    retryCameraAccess = startCamera;
    void startCamera();

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
        cameraDialog.nativeFallbackButton && !cameraDialog.nativeFallbackButton.hidden
          ? cameraDialog.nativeFallbackButton
          : null,
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
    if (document.hidden && activeCameraCancel && activeCameraReadyForVisibilityCancel) {
      activeCameraCancel();
    }
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
      reject(new Error("Unable to read the captured photo."));
    };
    image.src = objectUrl;
  });

  const compressImage = async (file, options = {}) => {
    if (!(file instanceof File) || !String(file.type || "").toLowerCase().startsWith("image/")) {
      throw new Error("Please capture a valid photo using the camera.");
    }
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      throw new Error("The captured photo is too large. Please retake it.");
    }

    const image = await loadImage(file);
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    if (!sourceWidth || !sourceHeight) {
      throw new Error("The captured photo has invalid dimensions.");
    }

    const maxWidth = Math.max(320, Number(options.maxWidth || 1280));
    const maxHeight = Math.max(320, Number(options.maxHeight || 1280));
    const maxOutputBytes = Math.max(120 * 1024, Number(options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES));
    const cropAspectRatio = Number(options.cropAspectRatio || 0);
    let cropX = 0;
    let cropY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    if (Number.isFinite(cropAspectRatio) && cropAspectRatio > 0) {
      if (cropWidth / cropHeight > cropAspectRatio) {
        cropWidth = cropHeight * cropAspectRatio;
        cropX = (sourceWidth - cropWidth) / 2;
      } else {
        cropHeight = cropWidth / cropAspectRatio;
        cropY = (sourceHeight - cropHeight) / 2;
      }
    }
    const initialScale = Math.min(1, maxWidth / cropWidth, maxHeight / cropHeight);
    let width = Math.max(1, Math.round(cropWidth * initialScale));
    let height = Math.max(1, Math.round(cropHeight * initialScale));
    let quality = Math.min(0.88, Math.max(0.62, Number(options.quality || 0.8)));
    let result = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("This device could not process the photo.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
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
      throw new Error("Unable to reduce the photo size. Please retake it.");
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
    const cropAspectRatio = Number(options.cropAspectRatio || (isLikelyMobileDevice() ? 3 / 4 : 0));
    let value = "";
    let processingToken = 0;
    let processing = false;
    let cameraActive = false;

    const setPreviewInteraction = (enabled) => {
      if (!previewImage) return;
      const previewFrame = previewImage.closest(".registration-photo-preview");
      previewImage.classList.toggle("is-previewable", enabled);
      previewFrame?.classList.toggle("has-photo", enabled);
      if (enabled) {
        previewImage.setAttribute("role", "button");
        previewImage.setAttribute("tabindex", "0");
        previewImage.setAttribute("aria-haspopup", "dialog");
        previewImage.setAttribute("aria-label", `View ${previewImage.alt || "captured photo"}`);
        previewImage.title = "View photo";
      } else {
        previewImage.removeAttribute("role");
        previewImage.removeAttribute("tabindex");
        previewImage.removeAttribute("aria-haspopup");
        previewImage.removeAttribute("aria-label");
        previewImage.removeAttribute("title");
      }
    };

    const showCurrentPhoto = () => {
      if (!value || !previewImage || previewImage.hidden) return;
      openPhotoPreview({
        source: previewImage.currentSrc || previewImage.src || value,
        title: String(options.previewTitle || "Photo Preview"),
        alt: previewImage.alt || "Captured photo",
        trigger: previewImage
      });
    };

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
        setPreviewInteraction(hasPhoto);
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
        setPreviewInteraction(false);
        if (placeholder) placeholder.hidden = false;
        setStatus("Unable to preview the photo.", "danger");
      });
      previewImage.addEventListener("load", () => {
        if (value) {
          previewImage.hidden = false;
          if (placeholder) placeholder.hidden = true;
          setPreviewInteraction(true);
          setStatus("Photo ready. Tap to view.", "success");
        }
      });
      previewImage.addEventListener("click", showCurrentPhoto);
      previewImage.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        showCurrentPhoto();
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
        const compressionOptions = cropAspectRatio > 0
          ? { ...options, cropAspectRatio }
          : options;
        const dataUrl = await compressImage(file, compressionOptions);
        if (token !== processingToken) return;
        await setValue(dataUrl, { notify: true });
        setStatus("Photo ready. Tap to view.", "success");
      } catch (error) {
        await setValue(previousValue);
        const message = error instanceof Error ? error.message : "Unable to process the photo.";
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
        if (nativeAppVersion > 0 && nativeAppVersion < MIN_NATIVE_CAMERA_APP_VERSION) {
          setStatus("The installed app is outdated. Install the signed v6 app to open the camera directly.", "danger");
          return;
        }
        const isMobileCamera = isLikelyMobileDevice();
        const directCameraUnavailable = !window.isSecureContext
          || !window.navigator?.mediaDevices?.getUserMedia;
        if (isMobileCamera && fileInput && directCameraUnavailable) {
          fileInput.value = "";
          fileInput.click();
          return;
        }

        const previousStatus = String(status?.textContent || emptyStatus);
        const previousTone = status?.classList.contains("text-success")
          ? "success"
          : (status?.classList.contains("text-danger") ? "danger" : "muted");
        cameraActive = true;
        setControlsDisabled(true);
        setStatus("Opening camera...", "muted");
        try {
          const file = await captureWithBrowserCamera({
            onNativeFallback: isMobileCamera && fileInput
              ? () => {
                  fileInput.disabled = false;
                  fileInput.value = "";
                  try {
                    fileInput.click();
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Unable to open the phone camera.";
                    setStatus(message, "danger");
                  }
                }
              : null
          });
          if (!file) {
            setStatus(previousStatus, previousTone);
            return;
          }
          await processCameraFile(file);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to open the camera.";
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
        if (processing || cameraActive || !value) return;
        const previousValue = value;
        processing = true;
        setControlsDisabled(true);
        let confirmed = false;
        try {
          const previewSource = previewImage?.currentSrc || previewImage?.src || previousValue;
          confirmed = typeof options.confirmRemove === "function"
            ? Boolean(await options.confirmRemove(previousValue))
            : await confirmPhotoRemoval({
                source: previewSource,
                title: String(options.removeTitle || "Remove Photo"),
                message: String(
                  options.removeMessage
                  || "Are you sure you want to remove this photo? This action cannot be undone."
                )
              });
          if (!confirmed || value !== previousValue) return;
          processingToken += 1;
          if (fileInput) fileInput.value = "";
          await setValue("", { notify: true });
          setStatus(emptyStatus, "muted");
        } catch (error) {
          await setValue(previousValue);
          const message = error instanceof Error ? error.message : "Unable to remove the photo.";
          setStatus(message, "danger");
        } finally {
          processing = false;
          if (!cameraActive) setControlsDisabled(false);
          const focusTarget = value ? removeButton : triggerButton;
          if (focusTarget && !focusTarget.disabled && !focusTarget.hidden) {
            focusTarget.focus({ preventScroll: true });
          }
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
