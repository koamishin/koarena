import { verifyWebhook } from '@clerk/tanstack-react-start/webhooks'
import { getPrisma } from '@koarena/db'
import { createFileRoute } from '@tanstack/react-router'

import { syncClerkUser } from '../features/auth/auth.server'

export const Route = createFileRoute('/api/clerk/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const evt = await verifyWebhook(request)

        switch (evt.type) {
          case 'user.created':
          case 'user.updated': {
            const data = evt.data
            await syncClerkUser({
              id: data.id,
              primaryEmailAddressId: data.primary_email_address_id,
              emailAddresses: data.email_addresses.map((address) => ({
                id: address.id,
                emailAddress: address.email_address,
              })),
              firstName: data.first_name,
              lastName: data.last_name,
              username: data.username,
              publicMetadata: data.public_metadata,
            })
            return new Response('ok', { status: 200 })
          }

          case 'user.deleted': {
            const prisma = getPrisma()
            // Keep the row if it owns content; a cascade would take a team's
            // tournament entries with it.
            const user = await prisma.user.findUnique({
              where: { id: evt.data.id },
              select: { id: true },
            })

            if (user) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  banned: true,
                  email: `deleted+${user.id}@koarena.invalid`,
                },
              })
            }

            return new Response('ok', { status: 200 })
          }

          default:
            return new Response('ok', { status: 200 })
        }
      },
    },
  },
})
