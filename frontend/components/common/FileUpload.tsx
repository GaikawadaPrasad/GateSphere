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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      const presignData: any = presignRes;
      const payload = presignData?.data || presignData || {};
      const { file_id, upload_url, method = "PUT", headers = {}, public_url } = payload;

      // 2. Upload file content to presigned destination or backend endpoint
      if (upload_url) {
        const uploadHeaders: Record<string, string> = { ...headers };
        if (!uploadHeaders["Content-Type"]) {
          uploadHeaders["Content-Type"] = file.type || "application/octet-stream";
        }
        await fetch(upload_url, {
          method,
          headers: uploadHeaders,
          body: file,
        });
      }

      // 3. Confirm upload
      const confirmRes = await uploadsApi.confirm(file_id);
      const confirmData: any = confirmRes;
      const confirmPayload = confirmData?.data || confirmData || {};
      const finalUrl = confirmPayload.url || public_url;

      setPreviewUrl(finalUrl);
      onUploadComplete(finalUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "File upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

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

      {previewUrl && (
        <div className="mt-1 flex items-center gap-2">
          {previewUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
            <img src={previewUrl} alt="Upload preview" className="w-16 h-16 object-cover rounded border" />
          ) : (
            <a
              href={previewUrl}
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
