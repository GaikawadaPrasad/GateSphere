"use client";

import React, { useState } from "react";
import { uploadsApi } from "@/lib/api";

interface FileUploadProps {
  kind: string;
  onUploadComplete: (url: string) => void;
  label?: string;
  accept?: string;
  currentUrl?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  kind,
  onUploadComplete,
  label = "Upload File",
  accept = "image/*,application/pdf",
  currentUrl,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately for images
    if (file.type.startsWith("image/")) {
      const blob = URL.createObjectURL(file);
      setLocalBlobUrl(blob);
      setPreviewUrl(blob);
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Presign request
      const presignRes = await uploadsApi.presign({
        kind,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
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

      // 2. Upload file content to presigned destination or backend endpoint
      if (upload_url) {
        const uploadHeaders: Record<string, string> = { ...headers, ...required_headers };
        if (!uploadHeaders["Content-Type"]) {
          uploadHeaders["Content-Type"] = file.type || "application/octet-stream";
        }
        const uploadRes = await fetch(upload_url, {
          method,
          headers: uploadHeaders,
          body: file,
        });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => "");
          throw new Error(
            `Storage upload failed (${uploadRes.status} ${uploadRes.statusText || "Forbidden"}). ${
              uploadRes.status === 403
                ? "Check Supabase bucket RLS policies / S3 credentials / CORS."
                : errText || ""
            }`
          );
        }
      }

      // 3. Confirm upload
      const confirmRes = await uploadsApi.confirm(file_id);
      const confirmData: any = confirmRes;
      const confirmPayload = confirmData?.data || confirmData || {};
      let rawUrl = confirmPayload.file_url || confirmPayload.url || file_url || public_url || "";
      // Strip any accidental quotes or whitespace
      rawUrl = rawUrl.trim().replace(/^["']+|["']+$/g, "").replace(/[\r\n]/g, "").trim();

      if (rawUrl) {
        setPreviewUrl(rawUrl);
        onUploadComplete(rawUrl);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "File upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const activePreview = previewUrl || localBlobUrl;
  const isImage =
    Boolean(activePreview?.match(/\.(jpg|jpeg|png|webp|gif)/i)) ||
    Boolean(activePreview?.startsWith("blob:")) ||
    Boolean(activePreview?.startsWith("data:"));

  return (
    <div className="file-upload-container flex flex-col gap-2">
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={handleFileChange}
          className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300"
        />
        {uploading && <span className="text-xs text-blue-600 animate-pulse">Uploading...</span>}
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      {activePreview && (
        <div className="mt-1 flex items-center gap-2">
          {isImage ? (
            <img
              src={activePreview}
              alt="Upload preview"
              className="w-16 h-16 object-cover rounded border"
              onError={(e) => {
                if (localBlobUrl && e.currentTarget.src !== localBlobUrl) {
                  e.currentTarget.src = localBlobUrl;
                }
              }}
            />
          ) : (
            <a
              href={activePreview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline font-mono"
            >
              View Document
            </a>
          )}
        </div>
      )}
    </div>
  );
};
