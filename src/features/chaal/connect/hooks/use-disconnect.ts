import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/use-confirm";
import { errorMessage } from "@/components/errors/error-page";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../../keys";
import { chaalMutations } from "../../queries";

/** Disconnecting Lichess, after asking (the account menu and the settings page). */
export function useDisconnectLichess() {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const disconnect = useMutation({
		...chaalMutations.disconnect(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: chaalKeys.connection() });
			toast.success(m.chaal_disconnected());
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const ask = async () => {
		const confirmed = await confirm({
			title: m.chaal_disconnect_title(),
			description: m.chaal_disconnect_description(),
			confirmLabel: m.chaal_disconnect(),
			destructive: true,
		});
		if (confirmed) disconnect.mutate();
	};
	return { ask, pending: disconnect.isPending };
}
