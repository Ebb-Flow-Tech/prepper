'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { TastingNoteImage } from '@/types';

export interface ImageWithId {
  id: number | null;
  data: string; // base64 string
  image_url?: string; // for existing images
  removed?: boolean; // marked for deletion but not yet deleted
}

interface ImageUploadPreviewProps {
  onImagesSelected: (images: ImageWithId[]) => void;
  uploadedImages?: TastingNoteImage[];
  onRemoveImage?: (imageId: number) => Promise<void>;
  isLoading?: boolean;
  isRemoving?: boolean;
}

export function ImageUploadPreview({
  onImagesSelected,
  uploadedImages = [],
  onRemoveImage,
  isLoading = false,
  isRemoving = false,
}: ImageUploadPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImages, setSelectedImages] = useState<ImageWithId[]>(() =>
    uploadedImages.map((img) => ({
      id: img.id,
      data: '',
      image_url: img.image_url,
      removed: false,
    }))
  );
  const [removingImageId, setRemovingImageId] = useState<number | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    const newBase64Images: ImageWithId[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove the data:image/...;base64, prefix
          const base64Data = base64.split(',')[1];
          newBase64Images.push({
            id: null,
            data: base64Data,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    const updated = [...selectedImages, ...newBase64Images];
    setSelectedImages(updated);
    onImagesSelected(updated);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveSelected = (index: number) => {
    const newSelected = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newSelected);
    onImagesSelected(newSelected);
  };

  const handleRemoveUploaded = (imageId: number) => {
    // Mark as removed locally, don't call onRemoveImage yet
    // Will be deleted when user saves
    const updated = selectedImages.map((img) =>
      img.id === imageId ? { ...img, removed: true } : img
    );
    setSelectedImages(updated);
    onImagesSelected(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Add Images
        </label>
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {isLoading ? 'Uploading...' : 'Click to select images or drag and drop'}
            </p>
          </button>
        </div>
      </div>

      {/* New images (id: null) */}
      {selectedImages.some((img) => img.id === null) && (
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
            New images ({selectedImages.filter((img) => img.id === null).length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {selectedImages.map(
              (image, index) =>
                image.id === null && (
                  <div
                    key={`new-${index}`}
                    className="relative group rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-square"
                  >
                    <img
                      src={`data:image/png;base64,${image.data}`}
                      alt={`New ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSelected(index)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                )
            )}
          </div>
        </div>
      )}

      {/* Existing images (id: not null and not removed) */}
      {selectedImages.some((img) => img.id !== null && !img.removed) && (
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
            Uploaded images ({selectedImages.filter((img) => img.id !== null && !img.removed).length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {selectedImages.map(
              (image) =>
                image.id !== null && !image.removed && (
                  <div
                    key={image.id}
                    className="relative group rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-square"
                  >
                    <img
                      src={image.image_url}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveUploaded(image.id!)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
