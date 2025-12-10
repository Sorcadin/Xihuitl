import {
    S3Client,
    GetObjectCommand, // The command we need to read/download the object
    GetObjectCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as dotenv from "dotenv";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-2";
const BUCKET = process.env.IMAGE_BUCKET || "xiuh-pet-images";


if (!REGION || !BUCKET ) {
    throw new Error("Missing AWS_REGION or BUCKET in environment. Set AWS_REGION and BUCKET in your .env file.");
}

const RESOLVED_REGION = REGION;
const RESOLVED_BUCKET = BUCKET;

// Initialize the S3 client once.
// Credentials will be automatically picked up from the EC2 Instance's IAM Role.
const s3Client = new S3Client({ region: RESOLVED_REGION });

/**
 * Generates a pre-signed URL for downloading a private S3 object.
 * This URL grants temporary public read access.
 * * @param objectKey The key (file path) of the S3 object (e.g., 'pet_01.gif').
 * @param expiresIn Time in seconds for the URL to remain valid (default: 300s / 5 minutes).
 * @returns The pre-signed URL as a string, or undefined if an error occurs.
 */
export async function createPresignedDownloadUrl(
    objectKey: string,
    expiresIn: number = 300 // 5 minutes validity
): Promise<string | undefined> {
    
    // Define the parameters for the GetObject operation
    const input: GetObjectCommandInput = {
        Bucket: RESOLVED_BUCKET,
        Key: `${objectKey}.png`,
    };
    
    // Create the GetObject command
    const command = new GetObjectCommand(input);

    try {
        // Generate the pre-signed URL
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error(`Error generating pre-signed URL for ${objectKey}:`, error);
        return undefined;
    }
}
