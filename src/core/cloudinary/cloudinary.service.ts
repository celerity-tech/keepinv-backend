import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';

import { env } from '../config/env.config';

/** Where an uploaded image ended up: the optimised delivery URL plus its source asset id. */
export interface UploadedImage {
  /** Optimised, ready-to-render delivery URL (auto format/quality, max-width capped). */
  url: string;
  /** Cloudinary public id of the source asset, used to overwrite/destroy it later. */
  publicId: string;
}

/** An Error carrying Cloudinary's HTTP status so the caller can map it to a clear response. */
type CloudinaryError = Error & { http_code?: number };

// Top-level Cloudinary folder for this app's assets (matches the dashboard folder).
const ROOT_FOLDER = 'rapidomotorsiklo';

/**
 * Thin wrapper over the Cloudinary SDK for product photos. Credentials are optional: when any are
 * missing the service reports itself unconfigured and uploads fail with a clear 503 instead of a
 * cryptic SDK error, so the rest of the API keeps working without Cloudinary set up.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor() {
    this.configured = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
    );

    if (this.configured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    } else {
      this.logger.warn('Cloudinary is not configured; product image upload is disabled.');
    }
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Upload (or overwrite) a product's photo. The asset is stored once per product under a
   * per-tenant folder; the returned URL adds only free, non-AI optimisations (auto format/quality
   * and a max-width cap) — the photo is delivered as uploaded.
   */
  async uploadProductImage(
    file: Buffer,
    params: { organizationId: string; productId: string },
  ): Promise<UploadedImage> {
    this.assertConfigured();

    const options: UploadApiOptions = {
      folder: `${ROOT_FOLDER}/products/${params.organizationId}`,
      public_id: params.productId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
    };

    let result: UploadApiResponse;
    try {
      result = await this.uploadBuffer(file, options);
    } catch (error) {
      throw this.toHttpError(error);
    }
    return { url: this.deliveryUrl(result.public_id), publicId: result.public_id };
  }

  // Map a Cloudinary upload failure to a clear API error. A 403 here is almost always a key-scope
  // problem (the API key lacks upload "create" permission), so call it out explicitly rather than
  // letting it surface as a generic 500.
  private toHttpError(error: unknown): BadGatewayException {
    const httpCode = (error as CloudinaryError).http_code;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Cloudinary upload failed (${httpCode ?? '?'}): ${message}`);

    if (httpCode === 403 || /permission/i.test(message)) {
      return new BadGatewayException(
        'Image hosting rejected the upload: the Cloudinary API key is missing upload ' +
          'permission. Use a key with media upload ("create") access.',
      );
    }
    return new BadGatewayException('Image upload failed. Please try again.');
  }

  /**
   * Permanently delete every product photo belonging to an organization, then its now-empty folder.
   * Used when a tenant is wiped. Safe to call when unconfigured. Failures are logged, never thrown:
   * the DB wipe has already committed, so a Cloudinary hiccup must not surface as a failed deletion.
   */
  async destroyProductImages(organizationId: string): Promise<void> {
    if (!this.configured) {
      return;
    }
    const prefix = `${ROOT_FOLDER}/products/${organizationId}`;
    try {
      // delete_resources_by_prefix removes up to 1000 assets per call; repeat while more remain.
      let partial = true;
      while (partial) {
        const result = await cloudinary.api.delete_resources_by_prefix(prefix, {
          resource_type: 'image',
          invalidate: true,
        });
        partial = Boolean((result as { partial?: boolean }).partial);
      }
      await cloudinary.api.delete_folder(prefix);
    } catch (error) {
      this.logger.warn(`Failed to purge Cloudinary folder ${prefix}: ${String(error)}`);
    }
  }

  /** Permanently delete a product photo by its public id. Safe to call when unconfigured. */
  async destroy(publicId: string): Promise<void> {
    if (!this.configured) {
      return;
    }
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
    } catch (error) {
      // A failed cleanup must never break the user-facing flow; log and move on.
      this.logger.warn(`Failed to destroy Cloudinary asset ${publicId}: ${String(error)}`);
    }
  }

  /**
   * Build the delivery URL for a stored asset. Uses only free, always-available transformations:
   * `q_auto`/`f_auto` to optimise format and quality, and `c_limit,w_1000` to cap the dimensions so
   * large phone photos don't ship full-resolution. No background removal (that's a paid AI add-on).
   */
  private deliveryUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1000, crop: 'limit' },
      ],
    });
  }

  /** Promisified upload_stream so an in-memory buffer can be sent without touching disk. */
  private uploadBuffer(file: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          const wrapped: CloudinaryError = new Error(
            error?.message ?? 'Cloudinary upload returned no result',
          );
          if (error?.http_code) {
            wrapped.http_code = error.http_code;
          }
          reject(wrapped);
          return;
        }
        resolve(result);
      });
      stream.end(file);
    });
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Image hosting is not configured. Set the CLOUDINARY_* environment variables.',
      );
    }
  }
}
