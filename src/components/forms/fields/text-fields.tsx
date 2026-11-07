import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { type PasswordStrength, passwordStrength } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldShell } from "../field-shell";

type InputProps = Pick<
	ComponentProps<"input">,
	"placeholder" | "autoComplete" | "inputMode" | "maxLength" | "autoFocus" | "readOnly" | "disabled"
>;

export type TextFieldProps = FieldBaseProps & InputProps & { type?: "text" | "email" | "url" | "search" | "tel" };

export function TextField({ label, description, optional, type = "text", ...input }: TextFieldProps) {
	const field = useFieldContext<string>();
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Input
					{...control}
					{...input}
					type={type}
					value={field.state.value ?? ""}
					onChange={(event) => field.handleChange(event.target.value)}
				/>
			)}
		</FieldShell>
	);
}

export function EmailField(props: Omit<TextFieldProps, "type">) {
	return <TextField type="email" inputMode="email" autoComplete="email" {...props} />;
}

export function UrlField(props: Omit<TextFieldProps, "type">) {
	return <TextField type="url" inputMode="url" autoComplete="url" placeholder="https://" {...props} />;
}

export type TextareaFieldProps = FieldBaseProps &
	Pick<ComponentProps<"textarea">, "placeholder" | "rows" | "maxLength" | "disabled"> & {
		/** Shows "N of MAX characters" (requires maxLength). */
		showCount?: boolean;
	};

export function TextareaField({ label, description, optional, showCount, ...textarea }: TextareaFieldProps) {
	const field = useFieldContext<string>();
	const value = field.state.value ?? "";
	const count =
		showCount && textarea.maxLength !== undefined ? (
			<p className="text-muted-foreground text-xs" aria-live="polite">
				{m.field_character_count({ count: formatNumber(value.length), max: formatNumber(textarea.maxLength) })}
			</p>
		) : null;
	return (
		<FieldShell label={label} description={description} optional={optional} after={count}>
			{(control) => (
				<Textarea
					{...control}
					{...textarea}
					rows={textarea.rows ?? 4}
					value={value}
					onChange={(event) => field.handleChange(event.target.value)}
				/>
			)}
		</FieldShell>
	);
}

const strengthLabel: Record<PasswordStrength, () => string> = {
	0: m.password_strength_0,
	1: m.password_strength_1,
	2: m.password_strength_2,
	3: m.password_strength_3,
	4: m.password_strength_4,
};

const strengthColor: Record<PasswordStrength, string> = {
	0: "bg-destructive",
	1: "bg-destructive",
	2: "bg-amber-500",
	3: "bg-green-600",
	4: "bg-green-700",
};

export type PasswordFieldProps = FieldBaseProps & {
	autoComplete?: "current-password" | "new-password";
	/** Shows a strength meter (use for new passwords). */
	showStrength?: boolean;
};

export function PasswordField({
	label,
	description,
	optional,
	autoComplete = "current-password",
	showStrength = false,
}: PasswordFieldProps) {
	const field = useFieldContext<string>();
	const [visible, setVisible] = useState(false);
	const value = field.state.value ?? "";
	const strength = passwordStrength(value);

	const meter = showStrength ? (
		<div className="flex flex-col gap-1" data-testid="password-strength">
			<div className="flex gap-1" aria-hidden>
				{[1, 2, 3, 4].map((step) => (
					<span
						key={step}
						className={cn("h-1 flex-1 rounded-full bg-muted", value && strength >= step && strengthColor[strength])}
					/>
				))}
			</div>
			<p className="text-muted-foreground text-xs" aria-live="polite">
				{value ? m.password_strength({ level: strengthLabel[strength]() }) : null}
			</p>
		</div>
	) : null;

	return (
		<FieldShell label={label} description={description} optional={optional} after={meter}>
			{(control) => (
				<InputGroup>
					<InputGroupInput
						{...control}
						type={visible ? "text" : "password"}
						autoComplete={autoComplete}
						value={value}
						onChange={(event) => field.handleChange(event.target.value)}
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							type="button"
							size="icon-xs"
							aria-label={visible ? m.password_hide() : m.password_show()}
							aria-pressed={visible}
							aria-controls={control.id}
							onClick={() => setVisible((current) => !current)}
						>
							{visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			)}
		</FieldShell>
	);
}
