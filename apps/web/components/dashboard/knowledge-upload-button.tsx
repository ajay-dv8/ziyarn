"use client";

import { useRef, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { CloudUpload, X } from "lucide-react";

import { API_ROUTES } from "@/constants/routes";

const ACCEPTED = ".pdf,.txt,.md,.html,.htm,.doc,.docx,.xls,.xlsx";
const MAX_FILES = 10;

export function KnowledgeUploadButton({
  domainId,
  agentId,
}: {
  domainId: string;
  agentId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function addFiles(newFiles: FileList | File[]) {
    const incoming = Array.from(newFiles);
    setFiles((prev) => {
      const combined = [...prev, ...incoming].slice(0, MAX_FILES);
      return combined;
    });
    setError(null);
    setSuccess(null);

    for (const file of incoming) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => ({
            ...prev,
            [file.name]: e.target?.result as string,
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[files[index]?.name ?? ""];
      return next;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  async function uploadAll() {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      setUploadProgress(`Uploading ${uploaded + 1} of ${files.length}...`);
      try {
        const form = new FormData();
        form.append("domainId", domainId);
        form.append("agentId", agentId);
        form.append("file", file);
        const res = await fetch(API_ROUTES.KNOWLEDGE_UPLOAD, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          uploaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setUploading(false);
    setUploadProgress(null);
    setFiles([]);
    setPreviews({});

    if (failed === 0) {
      setSuccess(`${uploaded} file(s) uploaded successfully.`);
      window.location.reload();
    } else if (uploaded === 0) {
      setError(`Failed to upload ${failed} file(s).`);
    } else {
      setSuccess(`${uploaded} uploaded, ${failed} failed.`);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-3">
      <Label>Upload files to the knowledge base</Label>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`${
          isDragging ? "border-primary bg-primary/5" : "border border-input"
        } cursor-pointer rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors duration-150`}
      >
        <CloudUpload className="mb-2 h-10 w-10 text-muted-foreground" />
        <div className="text-sm">
          <strong className="block text-muted-foreground">
            Drag & drop files here
          </strong>
          <span className="block text-xs text-muted-foreground">
            or click to browse — PDF, TXT, DOCX, XLSX, HTML
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                {previews[file.name] && file.type.startsWith("image/") ? (
                  <img
                    src={previews[file.name]}
                    alt={file.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-xs uppercase">
                    {file.name.split(".").pop()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(file.size / 1024)} KB
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={uploadAll}
              disabled={uploading}
              size="sm"
            >
              {uploading ? uploadProgress ?? "Uploading..." : "Upload"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiles([]);
                setPreviews({});
              }}
              disabled={uploading}
            >
              Clear all
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-600" role="status">
          {success}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        PDF, TXT, Markdown, HTML, DOCX, or XLSX — up to 4.45 MB each, max 10
        files. Text is extracted and embedded so your agent can answer from it.
      </p>
    </div>
  );
}
