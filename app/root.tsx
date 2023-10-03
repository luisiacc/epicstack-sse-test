import { parse } from '@conform-to/zod'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	json,
	type DataFunctionArgs,
	type HeadersFunction,
	type LinksFunction,
	type MetaFunction,
} from '@remix-run/node'
import {
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useFetchers,
	useMatches,
} from '@remix-run/react'
import { withSentry } from '@sentry/remix'
import * as React from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { EpicProgress } from './components/progress-bar.tsx'
import { SearchBar } from './components/search-bar.tsx'
import { Button } from './components/ui/button.tsx'
import fontStyleSheetUrl from './styles/font.css'
import tailwindStyleSheetUrl from './styles/tailwind.css'
import { useNonce } from './utils/nonce-provider.ts'

export const links: LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		// Preload CSS as a resource to avoid render blocking
		{ rel: 'preload', href: fontStyleSheetUrl, as: 'style' },
		{ rel: 'preload', href: tailwindStyleSheetUrl, as: 'style' },
		cssBundleHref ? { rel: 'preload', href: cssBundleHref, as: 'style' } : null,
		{ rel: 'mask-icon', href: '/favicons/mask-icon.svg' },
		{
			rel: 'alternate icon',
			type: 'image/png',
			href: '/favicons/favicon-32x32.png',
		},
		{ rel: 'apple-touch-icon', href: '/favicons/apple-touch-icon.png' },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		//These should match the css preloads above to avoid css as render blocking resource
		{ rel: 'icon', type: 'image/svg+xml', href: '/favicons/favicon.svg' },
		{ rel: 'stylesheet', href: fontStyleSheetUrl },
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
		cssBundleHref ? { rel: 'stylesheet', href: cssBundleHref } : null,
	].filter(Boolean)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data ? 'Epic Notes' : 'Error | Epic Notes' },
		{ name: 'description', content: `Your own captain's log` },
	]
}

export async function loader() {
	return json({})
}

const ThemeFormSchema = z.object({
	theme: z.enum(['system', 'light', 'dark']),
})

export async function action() {
	return json({ success: true })
}

function Document({
	children,
	nonce,
	env = {},
}: {
	children: React.ReactNode
	nonce: string
	env?: Record<string, string>
}) {
	return (
		<html lang="en" className={`h-full overflow-x-hidden`}>
			<head>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
				<LiveReload nonce={nonce} />
			</body>
		</html>
	)
}

function App() {
	const nonce = useNonce()
	const matches = useMatches()
	const isOnSearchPage = matches.find(m => m.id === 'routes/users+/index')
	const searchBar = isOnSearchPage ? null : <SearchBar status="idle" />

	return (
		<Document nonce={nonce}>
			<div className="flex h-screen flex-col justify-between">
				<header className="container py-6">
					<nav>
						<div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap md:gap-8">
							<Link to="/">
								<div className="font-light">epic</div>
								<div className="font-bold">notes</div>
							</Link>
							<div className="ml-auto hidden max-w-sm flex-1 sm:block">
								{searchBar}
							</div>
							<div className="flex items-center gap-10">
								<Button asChild variant="default" size="sm">
									<Link to="/login">Log In</Link>
								</Button>
							</div>
							<div className="block w-full sm:hidden">{searchBar}</div>
						</div>
					</nav>
				</header>

				<div className="flex-1">
					<Outlet />
				</div>

				<div className="container flex justify-between pb-5">
					<Link to="/">
						<div className="font-light">epic</div>
						<div className="font-bold">notes</div>
					</Link>
				</div>
			</div>
			<SSE />
			<EpicProgress />
		</Document>
	)
}
export default withSentry(App)


/**
 * If the user's changing their theme mode preference, this will return the
 * value it's being changed to.
 */
export function useOptimisticThemeMode() {
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(f => f.formAction === '/')

	if (themeFetcher && themeFetcher.formData) {
		const submission = parse(themeFetcher.formData, {
			schema: ThemeFormSchema,
		})
		return submission.value?.theme
	}
}


export function ErrorBoundary() {
	// the nonce doesn't rely on the loader so we can access that
	const nonce = useNonce()

	// NOTE: you cannot use useLoaderData in an ErrorBoundary because the loader
	// likely failed to run so we have to do the best we can.
	// We could probably do better than this (it's possible the loader did run).
	// This would require a change in Remix.

	// Just make sure your root route never errors out and you'll always be able
	// to give the user a better UX.

	return (
		<Document nonce={nonce}>
			<GeneralErrorBoundary />
		</Document>
	)
}

function SSE() {
	let [data, setData] = React.useState(null)

	React.useEffect(() => {
		const eventSource = new EventSource('/sse/ev1')

		eventSource.onmessage = event => {
			setData(event.data)
			console.log(event.data) // This will log the ping message
			// You can also update your component state here to display the data
		}

		eventSource.onerror = error => {
			console.error('EventSource failed:', error)
			eventSource.close()
		}

		// Clean up the connection when the component is unmounted
		return () => {
			eventSource.close()
		}
	}, [])

	return (
		<div>
			<h1>Server-Sent Events Page</h1>
			<pre>{data}</pre>
			{/* You can display the SSE data here if desired */}
		</div>
	)
}
