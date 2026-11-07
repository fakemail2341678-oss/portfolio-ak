import { FileTextIcon } from "lucide-react";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import type { ImageAsset } from "@/features/attachments/schema";
import { cn } from "@/lib/utils";

/** A library item's square preview: the image, or a document icon for a PDF (alt is described next to it). */
export function MediaThumb({ image, className }: { image: ImageAsset; className?: string }) {
	if (image.format === "pdf") {
		return (
			<div aria-hidden className={cn("flex items-center justify-center rounded border bg-muted", className)}>
				<FileTextIcon className="size-1/3 text-muted-foreground" />
			</div>
		);
	}
	return (
		<CloudImage
			image={image}
			variant="thumb"
			alt=""
			loading="lazy"
			className={cn("rounded border object-cover", className)}
		/>
	);
}
