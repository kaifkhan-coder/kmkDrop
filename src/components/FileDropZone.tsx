import React, { useRef, useState } from 'react';
import { UploadCloud, File, FileText, Image as ImageIcon, Archive, Music, Video, Code, Trash2, Plus } from 'lucide-react';
import { formatBytes, getFileCategory, FileCategory } from '../utils/format';

interface FileDropZoneProps {
  selectedFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onStartTransfer: () => void;
  isPeerConnected: boolean;
  onOpenQR: () => void;
  isSignedIn: boolean;
  onRequireAuth: () => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  selectedFiles,
  onFilesSelected,
  onRemoveFile,
  onClearFiles,
  onStartTransfer,
  isPeerConnected,
  onOpenQR,
  isSignedIn,
  onRequireAuth,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleZoneClick = () => {
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isSignedIn) {
      onRequireAuth();
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFilesSelected(filesArray);
    }
  };


  const renderFileIcon = (category: FileCategory) => {
    switch (category) {
      case 'image':
        return <ImageIcon className="h-5 w-5 text-indigo-500" />;
      case 'pdf':
      case 'document':
        return <FileText className="h-5 w-5 text-rose-500" />;
      case 'archive':
        return <Archive className="h-5 w-5 text-amber-500" />;
      case 'audio':
        return <Music className="h-5 w-5 text-violet-500" />;
      case 'video':
        return <Video className="h-5 w-5 text-blue-500" />;
      case 'code':
        return <Code className="h-5 w-5 text-emerald-500" />;
      default:
        return <File className="h-5 w-5 text-neutral-500" />;
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-neutral-900 bg-neutral-100/70 dark:border-white dark:bg-neutral-900/80 scale-[0.99]'
            : 'border-neutral-300/80 hover:border-neutral-400 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:border-neutral-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={!isSignedIn}
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 mb-3 shadow-inner">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h4 className="text-base font-semibold text-neutral-900 dark:text-white">
          Drop your files here, or <span className="underline decoration-neutral-400 underline-offset-4">browse</span>
        </h4>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
          Supports any format: PDF, Word (.docx), TXT, ZIP, Images (PNG, JPG), Audio, Video, and documents of any size.
        </p>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-400">
          <span>Direct browser-to-device transit</span>
          <span>·</span>
          <span>Zero server storage</span>
          <span>·</span>
          <span>AES-256-GCM encrypted</span>
        </div>

        {!isSignedIn && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-semibold">View-Only Mode:</span>
            <span>Sign in to select files and initiate transfers</span>
          </div>
        )}
      </div>

      {/* Selected Files Preview List */}
      {selectedFiles.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="text-xs font-semibold text-neutral-900 dark:text-white">
              Selected Files ({selectedFiles.length})
              <span className="ml-2 font-mono text-neutral-500 font-normal">
                Total: {formatBytes(totalSize)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add More</span>
              </button>
              <button
                onClick={onClearFiles}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-60 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => {
              const category = getFileCategory(file.name, file.type);
              return (
                <div key={idx} className="flex items-center justify-between py-2.5 group">
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {renderFileIcon(category)}
                    </div>
                    <div className="truncate">
                      <p className="truncate text-xs font-medium text-neutral-900 dark:text-white">
                        {file.name}
                      </p>
                      <p className="text-[11px] font-mono text-neutral-500">
                        {formatBytes(file.size)} · {file.type || 'Binary Document'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveFile(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-rose-600 transition dark:hover:bg-neutral-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Primary Transfer Action */}
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {isPeerConnected ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ● Peer device connected and ready
                </span>
              ) : (
                <span>Scan QR code with receiving device to connect</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isPeerConnected && (
                <button
                  onClick={onOpenQR}
                  className="w-full sm:w-auto rounded-xl border border-neutral-300 py-2.5 px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition whitespace-nowrap"
                >
                  Show QR Code
                </button>
              )}
              <button
                onClick={() => {
                  if (!isSignedIn) {
                    onRequireAuth();
                    return;
                  }
                  onStartTransfer();
                }}
                className="w-full sm:w-auto rounded-xl bg-neutral-900 py-2.5 px-6 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition whitespace-nowrap"
              >
                {!isSignedIn
                  ? 'Sign In to Transfer'
                  : isPeerConnected
                  ? 'Transfer Files Now'
                  : 'Send & Connect'}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
