import { openai } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';
import { uploadRecipeImage } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const { recipe_id, recipe_name, ingredients } = await request.json();

    if (!recipe_name?.trim()) {
      return Response.json(
        { error: 'No recipe name provided' },
        { status: 400 }
      );
    }

    // Build a descriptive prompt for food photography
    const ingredientsList = ingredients?.length
      ? `featuring ${ingredients.slice(0, 5).join(', ')}`
      : '';

    const prompt = `Professional food photography of "${recipe_name}" ${ingredientsList}.
Beautifully plated dish on a rustic wooden table.
Soft natural lighting from the side.
Shallow depth of field with bokeh background.
High-end restaurant presentation style.
Appetizing and delicious looking.
4K quality, photorealistic.`;

    const result = await generateImage({
      model: openai.image('dall-e-3'),
      prompt,
      size: '1024x1024',
    });

    // Get the base64 image data from the result
    const imageBase64 = result.image.base64;

    if (!imageBase64) {
      return Response.json(
        { error: 'No image generated' },
        { status: 500 }
      );
    }

    // If recipe_id is provided, upload the image to backend
    if (recipe_id) {
      try {
        const uploadedImage = await uploadRecipeImage(recipe_id, imageBase64);
        return Response.json({
          image_url: uploadedImage.image_url,
          stored: true,
        });
      } catch (storageError) {
        console.warn('Storage service unavailable, returning base64 data URL:', storageError);
      }
    }

    // Return as data URL if no recipe_id or storage failed
    return Response.json({
      image_url: `data:image/png;base64,${imageBase64}`,
      stored: false,
    });
  } catch (error) {
    console.error('Failed to generate image:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return Response.json(
          { error: 'AI service not configured' },
          { status: 503 }
        );
      }
      if (error.message.includes('rate limit')) {
        return Response.json(
          { error: 'Too many requests, please try again shortly' },
          { status: 429 }
        );
      }
      if (error.message.includes('content_policy')) {
        return Response.json(
          { error: 'Content policy violation. Please try a different recipe.' },
          { status: 400 }
        );
      }
    }

    return Response.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
