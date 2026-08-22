import { IsString, Matches, MaxLength } from 'class-validator';

// §44 — file upload validation: only a data-URL image, size-capped. ~7,000,000 base64
// chars covers a several-MB JPEG, generous for a phone camera photo the frontend has
// already downsized before sending (see apps/web scan page).
const DATA_URL_IMAGE_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;

export class ScanImageDto {
  @IsString()
  @MaxLength(7_000_000)
  @Matches(DATA_URL_IMAGE_PATTERN, { message: 'imageBase64 must be a data:image/... base64 string' })
  imageBase64: string;
}
