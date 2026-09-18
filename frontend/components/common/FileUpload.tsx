"use client";

import React, { useState, useRef } from "react";
import { uploadsApi } from "@/lib/api";
import { useUiStore } from "@/store/ui";
import { Modal } from "@/components/common/Modal";

interface FileUploadProps {
  kind: string;
  onUploadComplete: (url: string) => void;
  label?: string;
  accept?: string;
  currentUrl?: string;
  communityId?: string;
  enableCamera?: boolean;
}

/**
 * Resizes and compresses an image in-browser using HTML5 Canvas to prevent payload issues.
 */
async function compressImageIfPossible(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) {
    return file;
  }
  // Only compress if larger than 1MB
  if (file.size <= 1024 * 1024) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return resolve(file);
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            return resolve(file);
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(file);
    };
    img.src = blobUrl;
  });
}

export const FileUpload: React.FC<FileUploadProps> = ({
  kind,
  onUploadComplete,
  label = "Upload File",
  accept = "image/*,application/pdf",
  currentUrl,
  communityId,
  enableCamera = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  const activeCommunityId = useUiStore((s) => s.activeCommunityId);
  const effectiveCommunityId = communityId || activeCommunityId || undefined;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const processAndUploadFile = async (rawFile: File) => {
    if (!rawFile) return;

    // Show local preview immediately for images
    if (rawFile.type.startsWith("image/")) {
      const blob = URL.createObjectURL(rawFile);
      setLocalBlobUrl(blob);
      setPreviewUrl(blob);
    }

    setUploading(true);
    setError(null);

    try {
      // Step 1: Compress large images client-side
      const fileToUpload = await compressImageIfPossible(rawFile);

      // Step 2: Try Direct Upload (Fastest, avoids S3 CORS and port issues)
      let resolvedUrl: string | null = null;
      try {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("kind", kind);
        if (effectiveCommunityId) {
          formData.append("community_id", effectiveCommunityId);
        }

        const directRes: any = await uploadsApi.directUpload(formData);
        const directPayload = directRes?.data || directRes || {};
        resolvedUrl =
          directPayload.file_url ||
          directPayload.url ||
          directPayload.public_url ||
          null;
      } catch (directErr: any) {
        console.warn("Direct upload fallback to presigned pipeline:", directErr?.message || directErr);
        // Step 3: Fallback to Presigned S3 pipeline if direct upload is unavailable
        const presignRes = await uploadsApi.presign({
          kind,
          filename: fileToUpload.name,
          content_type: fileToUpload.type || "application/octet-stream",
          size_bytes: fileToUpload.size,
          community_id: effectiveCommunityId,
        });

        const presignData = (presignRes as any)?.data || presignRes;
        const {
          file_id,
          upload_url,
          method = "PUT",
          headers = {},
          required_headers = {},
          public_url,
          file_url,
        } = presignData;

        if (upload_url) {
          const uploadHeaders: Record<string, string> = { ...headers, ...required_headers };
          if (!uploadHeaders["Content-Type"]) {
            uploadHeaders["Content-Type"] = fileToUpload.type || "application/octet-stream";
          }
          const uploadRes = await fetch(upload_url, {
            method,
            headers: uploadHeaders,
            body: fileToUpload,
          });
          if (!uploadRes.ok) {
            const errText = await uploadRes.text().catch(() => "");
            throw new Error(`Storage upload failed (${uploadRes.status}): ${errText || "Check storage settings"}`);
          }
        }

        const confirmRes = await uploadsApi.confirm(file_id);
        const confirmData: any = confirmRes;
        const confirmPayload = confirmData?.data || confirmData || {};
        resolvedUrl = confirmPayload.file_url || confirmPayload.url || file_url || public_url || null;
      }

      if (resolvedUrl) {
        const cleanUrl = resolvedUrl.trim().replace(/^["']+|["']+$/g, "").replace(/[\r\n]/g, "").trim();
        setPreviewUrl(cleanUrl);
        onUploadComplete(cleanUrl);
      } else {
        throw new Error("Upload completed but no public URL returned");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "File upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activePreview = previewUrl || localBlobUrl;
  const isImage =
    Boolean(activePreview?.match(/\.(jpg|jpeg|png|webp|gif|heic|heif)/i)) ||
    Boolean(activePreview?.startsWith("blob:")) ||
    Boolean(activePreview?.startsWith("data:"));

  return (
    <div className="file-upload-container flex flex-col gap-2">
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>}

      {/* Hidden inputs for File and Live Camera */}
      <input
        type="file"
        ref={fileInputRef}
        accept={accept}
        disabled={uploading}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {enableCamera && (
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          disabled={uploading}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          📁 {uploading ? "Uploading..." : "Browse File"}
        </button>

        {enableCamera && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition shadow-sm disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
          >
            📷 Snap Photo / Camera
          </button>
        )}

        {uploading && (
          <span className="text-xs text-blue-600 font-medium animate-pulse">
            Processing & Uploading...
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      {activePreview && (
        <div className="mt-1 flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
          {isImage ? (
            <div
              className="relative cursor-pointer group flex-shrink-0"
              onClick={() => setLightboxOpen(true)}
              title="Click to view full-size photo"
            >
              <img
                src={activePreview}
                alt="Upload preview"
                className="w-14 h-14 object-cover rounded border border-slate-300 shadow-sm transition group-hover:opacity-90"
                onError={(e) => {
                  if (localBlobUrl && e.currentTarget.src !== localBlobUrl) {
                    e.currentTarget.src = localBlobUrl;
                  }
                }}
              />
              <span className="absolute bottom-0 right-0 bg-blue-600 text-white text-[9px] px-1 rounded font-bold">
                🔍
              </span>
            </div>
          ) : (
            <a
              href={activePreview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline font-mono"
            >
              📄 View Document
            </a>
          )}
          <div className="flex flex-col">
            <span className="text-xs text-emerald-600 font-semibold">
              ✓ Uploaded successfully
            </span>
            {isImage && (
              <span
                onClick={() => setLightboxOpen(true)}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                Click image to expand preview
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {isImage && activePreview && (
        <Modal
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          title="📷 Photograph Preview"
          size="md"
        >
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: "#0f172a",
                maxHeight: "70vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "0.75rem",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
              }}
            >
              <img
                src={activePreview}
                alt="Full size preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "65vh",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="px-4 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => setLightboxOpen(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
