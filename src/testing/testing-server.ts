import { readFileSync } from "node:fs"

import { serve } from "srvx"

serve({
  tls: {
    cert: readFileSync("../../cert.pem", "utf8"),
    key: readFileSync("../../key.pem", "utf8"),
  },
  port: 3000,
  fetch: (request) => {
    const { pathname } = new URL(request.url)
    console.log(`-> ${pathname}`)

    if (pathname.includes("success")) {
      return new Response("Ok")
    }

    if (pathname.includes("discord")) {
      return new Response("Error", { status: 404 })
    }

    if (pathname.includes("push")) {
      return new Response("Error", { status: 410 })
    }

    return new Response("Error", { status: 500 })
  },
})

console.log("listening on https:3000")
