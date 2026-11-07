import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Up to two initials from a name ("Sita Rai" -> "SR"), or the email's first letter. */
export const initials = (name: string, email = "") => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const letters = words.length > 1 ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}` : (words[0]?.slice(0, 2) ?? "");
	return (letters || email.slice(0, 1) || "?").toUpperCase();
};

const SIZES = { sm: "size-6 text-[0.625rem]", default: "size-7 text-caption", lg: "size-9 text-body" } as const;

/**
 * A person's picture, or their initials on the accent tint. Decorative: whatever
 * surrounds it names the person in words (a cell, a menu button), so it is hidden
 * from screen readers.
 */
export function UserAvatar({
	name,
	email,
	image,
	size = "default",
	className,
}: {
	name: string;
	email?: string;
	/** A picture URL; the initials show until it loads, and if it fails. */
	image?: string | null;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	return (
		<Avatar className={cn("rounded-md", SIZES[size], className)} aria-hidden="true">
			{image ? <AvatarImage src={image} alt="" className="object-cover" /> : null}
			<AvatarFallback className="rounded-md bg-accent-subtle font-medium text-[length:inherit] text-foreground">
				{initials(name, email)}
			</AvatarFallback>
		</Avatar>
	);
}

/**
 * A person in a table cell or a list: avatar, name (with an optional note such as
 * "(you)") and a second line (email, role). Both lines truncate in narrow columns.
 */
export function UserCell({
	name,
	detail,
	email,
	image,
	note,
	className,
}: {
	name: string;
	/** The second line; defaults to the email. */
	detail?: React.ReactNode;
	email?: string;
	image?: string | null;
	/** After the name, muted: "(you)". */
	note?: React.ReactNode;
	className?: string;
}) {
	const second = detail ?? email;
	return (
		<div className={cn("flex min-w-0 items-center gap-2.5", className)}>
			<UserAvatar name={name} email={email} image={image} size={second ? "lg" : "default"} />
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">
					{name || email}
					{note ? <span className="ms-1 font-normal text-caption text-muted-foreground">{note}</span> : null}
				</span>
				{second ? <span className="truncate text-caption text-muted-foreground">{second}</span> : null}
			</div>
		</div>
	);
}
