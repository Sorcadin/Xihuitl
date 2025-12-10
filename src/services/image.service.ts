import sharp from 'sharp';

// Define a common target size for all stitched images
const TARGET_SIZE = 450;

/**
 * Downloads images, stitches them in memory, and returns the composite image Buffer.
 * @param imageUrls - Array of presigned URLs for the individual images.
 * @returns A Promise that resolves to the composite image Buffer.
 */
export async function stitchImagesInMemory(imageUrls: string[]): Promise<Buffer> {
    if (imageUrls.length === 0) {
        throw new Error("No images provided for stitching.");
    }
    
    // Download images into Buffers
    const imageBuffers = await Promise.all(
        imageUrls.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download image from S3: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer); 
        })
    );
    
    // Determine the layout parameters based on the first image's size
    // For simplicity, let's assume a 1xN horizontal strip where N is imageUrls.length
    const firstImage = sharp(imageBuffers[0]);
    const metadata = await firstImage.metadata();
    const width = metadata.width ?? 500;
    const height = metadata.height ?? 500;
    
    // Prepare images for stitching (Sharp requires position data)
    let currentX = 0;
    
    const composites = await Promise.all(imageBuffers.map(async (buffer) => {
        // --- RESIZE OPERATION ---
        const resizedBuffer = await sharp(buffer)
            .resize(TARGET_SIZE, TARGET_SIZE, {
                // Use 'cover' to ensure the image fills the 450x450 area, cropping if necessary to maintain aspect ratio.
                fit: sharp.fit.cover,
            })
            .toBuffer();
        // ------------------------

        const composite = { 
            input: resizedBuffer, // Use the resized buffer
            left: currentX,
            top: 0
        };
        // Move the X position by the fixed TARGET_SIZE for the next image
        currentX += TARGET_SIZE; 
        return composite;
    }));

    // Stitch and return Buffer
    const totalWidth = TARGET_SIZE * imageBuffers.length;

    const compositeBuffer = await sharp({
        create: {
            width: totalWidth,
            height: TARGET_SIZE,
            channels: 4,                        
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(composites)
    .png()
    .toBuffer();

    return compositeBuffer;
}
