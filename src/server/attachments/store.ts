import "@tanstack/react-start/server-only";
import { serverEnv } from "../env";
import { createCloudinary, type ImageStore } from "./cloudinary";

/** The configured Cloudinary store, or null when CLOUDINARY_* is unset (uploads disabled). */
export const imageStore: ImageStore | null =
	serverEnv.CLOUDINARY_CLOUD_NAME && serverEnv.CLOUDINARY_API_KEY && serverEnv.CLOUDINARY_API_SECRET
		? createCloudinary({
				cloudName: serverEnv.CLOUDINARY_CLOUD_NAME,
				apiKey: serverEnv.CLOUDINARY_API_KEY,
				apiSecret: serverEnv.CLOUDINARY_API_SECRET,
				folder: serverEnv.CLOUDINARY_FOLDER,
				apiBase: serverEnv.CLOUDINARY_API_BASE,
				deliveryBase: serverEnv.CLOUDINARY_DELIVERY_BASE,
			})
		: null;
