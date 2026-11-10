import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import {
	CommunityHeader,
	CommunityOff,
	LichessPrompt,
	ListWaiting,
	useAreaOn,
	useLichessFor,
} from "../community/header";
import { CHAAL_PATHS, chaalLinks } from "../links";
import type { StudiesSearch } from "../search";
import { studyAddress } from "./chapters";
import { myStudiesQueryOptions, studiesAccount, studiesByQueryOptions } from "./queries";
import type { StudySummary } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/studies/");

/**
 * /app/chaal/studies (Task 83, decision 0273; noindex: people's work): an account's public
 * studies (`?by=`, else the account the admin chose: Lichess's own), the player's own with
 * private ones (`?view=mine`, with their token), and opening any study by its address. Each
 * opens its chapters here.
 */
export function ChaalStudiesPage() {
	const search = route.useSearch();
	const on = useAreaOn("studies");
	const queryClient = useQueryClient();
	const by = studiesAccount(queryClient, search);
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-studies">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<CommunityHeader current="studies" title={m.ch_studies_title()} intro={m.ch_studies_intro()} />
				{on ? (
					<>
						<Toolbar search={search} by={by} />
						{search.view === "mine" ? <Mine /> : <ByAccount by={by} />}
					</>
				) : (
					<CommunityOff area="studies" />
				)}
			</div>
		</main>
	);
}

function Toolbar({ search, by }: { search: StudiesSearch; by: string }) {
	const navigate = useNavigate();
	const [address, setAddress] = useState("");
	const [wrong, setWrong] = useState(false);
	const findBy = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const name = String(new FormData(event.currentTarget).get("by") ?? "").trim();
		if (name) void navigate(chaalLinks.studies({ by: name }));
	};
	const open = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const study = studyAddress(address);
		if (!study) {
			setWrong(true);
			return;
		}
		void navigate(chaalLinks.study(study.id, study.chapter ? { chapter: study.chapter } : {}));
	};
	const views = [
		{
			key: "by",
			search: search.by ? { by: search.by } : {},
			label: m.ch_studies_by({ name: by }),
			current: search.view !== "mine",
		},
		{ key: "mine", search: { view: "mine" as const }, label: m.ch_studies_mine(), current: search.view === "mine" },
	];
	return (
		<div className="flex flex-col gap-4">
			<ul className="flex flex-wrap gap-1" aria-label={m.ch_studies_views()}>
				{views.map((view) => (
					<li key={view.key}>
						<Button asChild variant={view.current ? "default" : "ghost"} size="sm">
							<Link
								{...chaalLinks.studies(view.search)}
								aria-current={view.current ? "page" : undefined}
								data-testid={`chaal-studies-${view.key}`}
							>
								{view.label}
							</Link>
						</Button>
					</li>
				))}
			</ul>
			<div className="grid gap-4 sm:grid-cols-2">
				<search>
					<form
						method="get"
						action={localizeHref(CHAAL_PATHS.studies)}
						onSubmit={findBy}
						className="flex flex-col gap-1.5"
					>
						<label htmlFor="chaal-studies-by" className="text-sm">
							{m.ch_studies_by_label()}
						</label>
						<div className="flex items-center gap-2">
							<Input
								id="chaal-studies-by"
								name="by"
								type="search"
								defaultValue={search.by ?? ""}
								minLength={2}
								maxLength={30}
								placeholder={m.ch_studies_by_placeholder()}
								data-testid="chaal-studies-by-input"
							/>
							<Button type="submit" variant="outline" size="icon" aria-label={m.ch_studies_by_find()}>
								<SearchIcon aria-hidden />
							</Button>
						</div>
					</form>
				</search>
				<form onSubmit={open} className="flex flex-col gap-1.5">
					<label htmlFor="chaal-studies-open" className="text-sm">
						{m.ch_studies_open_label()}
					</label>
					<div className="flex items-center gap-2">
						<Input
							id="chaal-studies-open"
							value={address}
							onChange={(event) => {
								setAddress(event.target.value);
								setWrong(false);
							}}
							maxLength={200}
							placeholder={m.ch_studies_open_placeholder()}
							aria-invalid={wrong || undefined}
							aria-describedby={wrong ? "chaal-studies-open-error" : undefined}
							data-testid="chaal-studies-open-input"
						/>
						<Button type="submit" variant="outline" size="icon" aria-label={m.ch_studies_open()}>
							<ArrowRightIcon aria-hidden />
						</Button>
					</div>
					{wrong ? (
						<p id="chaal-studies-open-error" className="text-ch-danger text-xs">
							{m.ch_studies_open_wrong()}
						</p>
					) : null}
				</form>
			</div>
		</div>
	);
}

function ByAccount({ by }: { by: string }) {
	const list = useQuery(studiesByQueryOptions(by));
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-studies-error"
			/>
		);
	return (
		<StudySection
			id="chaal-studies-list"
			title={m.ch_studies_by({ name: by })}
			studies={list.data.studies}
			empty={m.ch_studies_none()}
		/>
	);
}

function Mine() {
	const use = useLichessFor("studies");
	const list = useQuery({ ...myStudiesQueryOptions(), enabled: use === "ok" });
	if (use !== "ok")
		return <LichessPrompt use={use} text={m.ch_studies_mine_connect()} testId="chaal-studies-connect" />;
	if (!list.data)
		return (
			<ListWaiting
				error={list.isError ? list.error : null}
				retry={() => void list.refetch()}
				testId="chaal-studies-error"
			/>
		);
	return (
		<StudySection
			id="chaal-studies-mine"
			title={m.ch_studies_mine()}
			studies={list.data}
			empty={m.ch_studies_mine_none()}
		/>
	);
}

function StudySection({
	id,
	title,
	studies,
	empty,
}: {
	id: string;
	title: string;
	studies: ReadonlyArray<StudySummary>;
	empty: string;
}) {
	return (
		<section aria-labelledby={id} className="flex flex-col gap-2" data-testid={id}>
			<h2 id={id} className="ch-rule pt-3 font-semibold">
				{title}
			</h2>
			{studies.length === 0 ? (
				<p className="text-ch-muted text-sm">{empty}</p>
			) : (
				<ul className="flex flex-col">
					{studies.map((study) => (
						<li key={study.id} className="ch-hairline" data-testid="chaal-study-row" data-study={study.id}>
							<Link {...chaalLinks.study(study.id)} className="flex flex-col gap-0.5 py-3 hover:bg-ch-plate">
								<span className="font-semibold">{study.name}</span>
								{study.updatedAt ? (
									<span className="text-ch-muted text-xs">
										{m.ch_studies_updated({ date: formatDate(study.updatedAt) })}
									</span>
								) : null}
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
