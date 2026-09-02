import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

import type { UploadFolder, UploadSignatureResponse } from '@isd/shared-types';
import { AppConfigService } from '@/config/config.service';

/** Named transformations from PROJECT_PLAN.md §13.2. */
export const CLOUDINARY_PRESETS = {
  /**
   * `c_pad` on a white ground, not `c_fill`. Industrial products are
   * irregularly shaped and cropping cuts off the part the buyer is trying to
   * identify — a nozzle whose thread is cropped out is a useless photo.
   */
  productCard: 'w_400,h_400,c_pad,b_white,q_auto,f_auto',
  productMain: 'w_800,h_800,c_pad,b_white,q_auto,f_auto',
  productThumb: 'w_120,h_120,c_pad,b_white,q_auto,f_auto',
  adminThumb: 'w_80,h_80,c_fill,q_auto,f_auto',
  banner: 'w_1600,c_fill,q_auto,f_auto',
  catalogueCover: 'w_400,c_fit,q_auto,f_auto',
} as const;

export type CloudinaryPreset = keyof typeof CLOUDINARY_PRESETS;

/** How long a signed catalogue download URL stays valid (§13.3). */
export const CATALOGUE_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    const { cloudName, apiKey, apiSecret } = this.config.cloudinary;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.logger.log(`Cloudinary configured for cloud '${cloudName}'`);
  }

  /**
   * Signed direct-to-Cloudinary upload params (§13.1).
   *
   * The browser uploads straight to Cloudinary; the file never passes through
   * this process. That matters on a free-tier instance with tight memory —
   * the catalogue PDF alone can be tens of megabytes.
   */
  buildUploadSignature(params: {
    folder: UploadFolder;
    resourceType: 'image' | 'raw';
    productId?: string;
  }): UploadSignatureResponse {
    const { cloudName, apiKey, apiSecret } = this.config.cloudinary;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = this.folderFor(params.folder, params.productId);

    const toSign: Record<string, string | number> = { folder, timestamp };

    // The catalogue PDF is uploaded as an authenticated raw resource so it can
    // only be reached through a signed, expiring URL — otherwise the lead form
    // in front of it is decorative (§13.3).
    if (params.resourceType === 'raw') {
      toSign.type = 'authenticated';
    }

    const signature = cloudinary.utils.api_sign_request(toSign, apiSecret);

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      resourceType: params.resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${params.resourceType}/upload`,
    };
  }

  /**
   * Builds a delivery URL for a stored publicId.
   *
   * Transformed URLs are never persisted — only the publicId and the base
   * secure_url are (§13.2). Storing a transformed URL bakes today's preset
   * into the database and makes re-tuning image sizes a migration.
   */
  buildUrl(publicId: string, preset: CloudinaryPreset): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [{ raw_transformation: CLOUDINARY_PRESETS[preset] }],
    });
  }

  /** Time-limited signed URL for an authenticated raw asset (the catalogue PDF). */
  buildSignedDownloadUrl(
    publicId: string,
    ttlSeconds = CATALOGUE_URL_TTL_SECONDS,
  ): { url: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const url = cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });

    return { url, expiresAt };
  }

  /**
   * Destroys an asset. Called when an admin removes a product image.
   *
   * Soft-deleting a product deliberately does NOT call this — that action is
   * reversible, and orphaned assets are reconciled by a separate script (§13.4).
   */
  async destroy(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        ...(resourceType === 'raw' ? { type: 'authenticated' } : {}),
        invalidate: true,
      });
    } catch (error) {
      // A failed remote delete must not fail the admin's save. The asset is
      // orphaned, which the reconciliation script exists to clean up.
      this.logger.error(
        `Failed to destroy Cloudinary asset '${publicId}': ${(error as Error).message}`,
      );
    }
  }

  private folderFor(folder: UploadFolder, productId?: string): string {
    const root = this.config.cloudinary.folder;
    if (folder === 'products' && productId) {
      return `${root}/products/${productId}`;
    }
    return `${root}/${folder}`;
  }
}
