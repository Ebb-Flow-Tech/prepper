'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Wand2, Trash2, Star } from 'lucide-react';
import { useRecipeImages, useUploadRecipeImage, useGenerateRecipeImage, useSetMainRecipeImage, useDeleteRecipeImage } from '@/lib/hooks';
import { Button } from '@/components/ui';

interface RecipeImageCarouselProps {
  recipeId: number;
  recipeName: string;
  ingredients?: string[];
}

export function RecipeImageCarousel({ recipeId, recipeName, ingredients }: RecipeImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: images = [] } = useRecipeImages(recipeId);
  const uploadMutation = useUploadRecipeImage();
  const generateMutation = useGenerateRecipeImage();
  const setMainImageMutation = useSetMainRecipeImage();
  const deleteImageMutation = useDeleteRecipeImage();

  const handlePrevious = () => {
    setCurrentIndex((prev: number) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev: number) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64String = (e.target?.result as string).split(',')[1]; // Remove data URL prefix
      try {
        await uploadMutation.mutateAsync({ recipeId, imageBase64: base64String });
        // Move to the new image (will be refetched by query)
        setCurrentIndex((prev) => prev + 1);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      await generateMutation.mutateAsync({
        recipeId,
        recipeName,
        ingredients,
      });
      // Move to the new image (will be refetched by query)
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSetAsMain = async () => {
    if (!currentImage) return;
    try {
      await setMainImageMutation.mutateAsync(currentImage.id);
    } catch (error) {
      console.error('Failed to set image as main:', error);
    }
  };

  const handleDeleteImage = async () => {
    if (!currentImage) return;
    try {
      await deleteImageMutation.mutateAsync(currentImage.id);
      // Move to previous image if available, otherwise move to first
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  // Ensure currentIndex is within bounds (handles race conditions during image fetch)
  const validIndex = Math.min(currentIndex, images.length - 1);
  const currentImage = images[validIndex];
  const hasImages = images.length > 0;

  return (
    <div className="space-y-4">
      {/* Carousel */}
      <div className="relative bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden mx-auto max-w-sm max-h-96">
        {hasImages ? (
          <>
            <img
              src={currentImage.image_url}
              alt={`Recipe image ${validIndex + 1}`}
              className="w-full aspect-square object-cover"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        idx === validIndex
                          ? 'bg-white'
                          : 'bg-white/50'
                      }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-zinc-400">
            <div className="text-center">
              <ImagePlus className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">No images yet</p>
            </div>
          </div>
        )}
      </div>

      {/* Image counter and action buttons */}
      {hasImages && (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {validIndex + 1} of {images.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetAsMain}
              disabled={currentImage?.is_main || setMainImageMutation.isPending}
              className="disabled:opacity-50 disabled:cursor-not-allowed text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
              title={currentImage?.is_main ? "This is already the preferred image" : "Set as preferred image"}
            >
              <Star className={`h-4 w-4 ${currentImage?.is_main ? 'fill-amber-600 dark:fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={handleDeleteImage}
              disabled={deleteImageMutation.isPending}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete this image"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploadMutation.isPending}
        />
        <Button
          variant="outline"
          className="w-full cursor-pointer"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Image
        </Button>

        <Button
          onClick={handleGenerateImage}
          disabled={isGeneratingImage || generateMutation.isPending}
          className="w-full"
          variant="default"
        >
          {isGeneratingImage || generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate with AI
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
