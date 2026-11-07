import { PlayIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";
import { videoLabel } from "./labels";
import type { TitleVideo } from "./types";

/** YouTube's privacy-enhanced embed: the one video origin Parda's CSP frames (PLAN 12.5). */
export const youtubeEmbed = (key: string) =>
	`https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0&modestbranding=1`;

/** A video's still, from YouTube's image host (in Parda's img-src). 320×180. */
export const youtubeStill = (key: string) => `https://i.ytimg.com/vi/${encodeURIComponent(key)}/mqdefault.jpg`;

/**
 * A trailer or clip in a dialog, between the masks: the iframe exists only while the
 * dialog is open, so a title page loads nothing from YouTube until asked.
 */
export function VideoDialog({ video, title, children }: { video: TitleVideo; title: string; children: ReactNode }) {
	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent
				className="w-[min(100%-2rem,calc((100dvh-8rem)*16/9))] max-w-none gap-3 rounded-none border-0 bg-pd-mask p-0 pt-12 text-pd-ink sm:max-w-none"
				data-testid="video-dialog"
			>
				<div className="px-4">
					<DialogTitle className="truncate font-medium text-sm">{video.name || videoLabel(video.type)}</DialogTitle>
					<DialogDescription className="sr-only">{m.pd_video_dialog({ title })}</DialogDescription>
				</div>
				<div className="relative aspect-video bg-black">
					<iframe
						src={youtubeEmbed(video.key)}
						title={video.name || videoLabel(video.type)}
						allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
						// YouTube refuses an embed that sends no referrer (its error 153).
						referrerPolicy="strict-origin-when-cross-origin"
						className="absolute inset-0 size-full"
						data-testid="video-frame"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** A video's card: its still with a play mark, its kind and name under it. Opens the dialog. */
export function VideoCard({ video, title }: { video: TitleVideo; title: string }) {
	return (
		<VideoDialog video={video} title={title}>
			<button
				type="button"
				className="group pd-press block w-full text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground"
				data-testid="video-card"
			>
				<span className="relative block aspect-video overflow-hidden bg-pd-ground-2">
					<img
						src={youtubeStill(video.key)}
						alt=""
						width={320}
						height={180}
						loading="lazy"
						decoding="async"
						className="absolute inset-0 size-full object-cover"
					/>
					<span className="absolute start-2 bottom-2 flex size-9 items-center justify-center bg-pd-mask text-pd-ink">
						<PlayIcon aria-hidden className="size-4" />
					</span>
				</span>
				<span className="mt-2 flex flex-col gap-0.5">
					<span className="h-4 text-pd-muted text-xs">{videoLabel(video.type)}</span>
					<span className="line-clamp-2 h-[2lh] font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
						{video.name}
					</span>
				</span>
			</button>
		</VideoDialog>
	);
}
