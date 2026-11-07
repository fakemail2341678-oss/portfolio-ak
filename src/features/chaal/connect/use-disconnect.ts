import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../keys";
import { disconnectChaalMutationOptions } from "../queries";

/** Disconnecting Lichess, after asking (the account menu and the settings page). */
export function useDisconnectLichess() {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const disconnect = useMutation({
		...disconnectChaalMutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: chaalKeys.connection() });
			toast.success(m.ch_disconnected());
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const ask = async () => {
		const confirmed = await confirm({
			title: m.ch_disconnect_title(),
			description: m.ch_disconnect_description(),
			confirmLabel: m.ch_disconnect(),
			destructive: true,
		});
		if (confirmed) disconnect.mutate();
	};
	return { ask, pending: disconnect.isPending };
}
