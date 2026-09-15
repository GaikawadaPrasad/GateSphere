"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "./Modal";
import {
  decodeQrFromFile,
  decodeQrFromVideo,
  parseQrPayload,
  type ParsedQrData,
} from "@/lib/qr-decoder";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (raw: string, parsed: ParsedQrData) => void;
  defaultMode?: "camera" | "upload";
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScan,
  defaultMode = "upload",
}: QrScannerModalProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">(defaultMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef(false);

  // Play pleasant beep sound using Web Audio API on successful scan
  const playBeep = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch {
      // Non-fatal if audio context fails
    }
  }, []);

  const handleSuccessfulScan = useCallback(
    (raw: string) => {
      if (!raw) return;
      playBeep();
      const parsed = parseQrPayload(raw);
      onScan(raw, parsed);
      onClose();
    },
    [onScan, onClose, playBeep]
  );

  // Stop camera stream & release hardware
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Frame scanning loop for video stream
  const scanVideoFrame = useCallback(() => {
    if (!isScanningRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement("canvas");
      }
      const decoded = decodeQrFromVideo(video, offscreenCanvasRef.current);
      if (decoded) {
        stopCamera();
        handleSuccessfulScan(decoded);
        return;
      }
    }

    // Schedule next frame check
    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  }, [handleSuccessfulScan, stopCamera]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Camera access is not supported by your browser or requires HTTPS. Please use the Upload & Scan option."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsCameraActive(true);
        isScanningRef.current = true;
        animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.warn("[QrScannerModal] Camera error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access in browser settings or use the Upload & Scan option."
        );
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCameraError(
          "No camera hardware detected on this device. Please use the Upload & Scan option."
        );
      } else {
        setCameraError(
          `Unable to access camera: ${err?.message || "Unknown error"}. Please use the Upload & Scan option.`
        );
      }
      setIsCameraActive(false);
    }
  }, [scanVideoFrame, stopCamera]);

  // Handle uploaded file (via input or drag & drop)
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file (PNG, JPG, WEBP, etc.).");
      return;
    }

    setIsProcessingUpload(true);
    setUploadError(null);
    setUploadSuccess(null);

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);

    try {
      const result = await decodeQrFromFile(file);
      if (result.success && result.data) {
        setUploadSuccess(`✓ QR Code successfully decoded: ${result.data}`);
        setTimeout(() => {
          handleSuccessfulScan(result.data!);
        }, 350);
      } else {
        setUploadError(
          result.error ||
            "No QR code found in the image. Please make sure the QR code is clear, well-lit, and in focus."
        );
      }
    } catch (err: any) {
      setUploadError(err?.message || "Error processing image file.");
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultMode);
      setCameraError(null);
      setUploadError(null);
      setUploadSuccess(null);
      setPreviewImage(null);
      if (defaultMode === "camera") {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, defaultMode, startCamera, stopCamera]);

  // Switch between tabs
  const handleTabChange = (tab: "camera" | "upload") => {
    setActiveTab(tab);
    if (tab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="Scan Gate Pass QR Code"
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "8px",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("upload")}
            style={{
              flex: 1,
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              background: activeTab === "upload" ? "#ffffff" : "transparent",
              color: activeTab === "upload" ? "var(--brand-primary)" : "var(--muted)",
              boxShadow: activeTab === "upload" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            📁 Upload & Scan Image
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("camera")}
            style={{
              flex: 1,
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              background: activeTab === "camera" ? "#ffffff" : "transparent",
              color: activeTab === "camera" ? "var(--brand-primary)" : "var(--muted)",
              boxShadow: activeTab === "camera" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            📷 Live Camera Scan
          </button>
        </div>

        {/* Tab 1: Upload & Scan */}
        {activeTab === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processImageFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging
                  ? "2px dashed var(--brand-primary)"
                  : "2px dashed #cbd5e1",
                background: isDragging ? "var(--primary-light)" : "#f8fafc",
                borderRadius: "12px",
                padding: "2rem 1.5rem",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                minHeight: "180px",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processImageFile(e.target.files[0]);
                  }
                }}
              />

              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "var(--brand-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                }}
              >
                📸
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--brand-heading)" }}>
                  Click to select QR image or drag & drop here
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  Supports PNG, JPG, JPEG, WEBP, SVG screenshot or pass photos
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: "0.45rem 1.2rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  marginTop: "0.5rem",
                  pointerEvents: "none",
                }}
              >
                Choose Image File
              </button>
            </div>

            {/* Scanning Indicator */}
            {isProcessingUpload && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--brand-primary-light)",
                  borderRadius: "8px",
                  color: "var(--brand-primary)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <span className="spinner" style={{ width: "16px", height: "16px" }} />
                Scanning image for QR Code token...
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--success-light)",
                  border: "1px solid var(--success-border)",
                  borderRadius: "8px",
                  color: "#065f46",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                {uploadSuccess}
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--danger-light)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                ⚠️ {uploadError}
              </div>
            )}

            {/* Preview Thumbnail if loaded */}
            {previewImage && !uploadSuccess && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem",
                  background: "#f1f5f9",
                  borderRadius: "8px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt="Uploaded QR Preview"
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, fontSize: "0.85rem", color: "var(--brand-body)" }}>
                  Uploaded file loaded. If scanning fails, try cropping closer to the QR code.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Camera */}
        {activeTab === "camera" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {cameraError ? (
              <div
                style={{
                  padding: "1.25rem",
                  background: "var(--danger-light)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "0.95rem",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
                  📷 Camera Unavailable
                </div>
                <div>{cameraError}</div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleTabChange("upload")}
                  style={{ marginTop: "1rem", fontSize: "0.9rem", padding: "0.5rem 1rem" }}
                >
                  📁 Switch to Upload & Scan Image
                </button>
              </div>
            ) : (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "280px",
                  background: "#000000",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <video
                  ref={videoRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  autoPlay
                  muted
                  playsInline
                />

                {/* Viewfinder Target Frame Overlay */}
                <div
                  style={{
                    position: "absolute",
                    width: "190px",
                    height: "190px",
                    border: "2px solid rgba(255, 255, 255, 0.8)",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Targeting corner markers */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      left: "-2px",
                      width: "24px",
                      height: "24px",
                      borderTop: "4px solid #2563eb",
                      borderLeft: "4px solid #2563eb",
                      borderTopLeftRadius: "12px",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      right: "-2px",
                      width: "24px",
                      height: "24px",
                      borderTop: "4px solid #2563eb",
                      borderRight: "4px solid #2563eb",
                      borderTopRightRadius: "12px",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      left: "-2px",
                      width: "24px",
                      height: "24px",
                      borderBottom: "4px solid #2563eb",
                      borderLeft: "4px solid #2563eb",
                      borderBottomLeftRadius: "12px",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      width: "24px",
                      height: "24px",
                      borderBottom: "4px solid #2563eb",
                      borderRight: "4px solid #2563eb",
                      borderBottomRightRadius: "12px",
                    }}
                  />

                  {/* Scanning Laser Line */}
                  <div
                    style={{
                      width: "90%",
                      height: "2px",
                      background: "#2563eb",
                      boxShadow: "0 0 8px #3b82f6",
                      animation: "pulse 1.5s infinite ease-in-out",
                    }}
                  />
                </div>

                {/* Subtitle instruction on video */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "12px",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#ffffff",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Align QR Code inside box
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                {isCameraActive ? "🟢 Camera active • Looking for QR code..." : "Connecting camera..."}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={startCamera}
                style={{ fontSize: "0.85rem", padding: "0.35rem 0.8rem" }}
              >
                🔄 Refresh Camera
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
