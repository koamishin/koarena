import { ClerkProvider } from '@clerk/tanstack-react-start'
import { shadcn } from '@clerk/ui/themes'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { KoArenaFooter } from '../components/KoArenaFooter'
import { KoArenaHeader } from '../components/KoArenaHeader'
import { TooltipProvider } from '../components/ui/tooltip'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'KoArena — tournaments for programmers' },
      {
        name: 'description',
        content:
          'Run CTFs, hackathons, attack & defense and algorithmic rounds. One platform, eight game modes, any set of languages.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the theme
            script must run before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <KoArenaHeader />
              <main className="flex-1">{children}</main>
              <KoArenaFooter />
            </div>
          </TooltipProvider>
        </ClerkProvider>
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
