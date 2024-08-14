Bun.serve({
  cert: Bun.file("../../cert.pem"),
  key: Bun.file("../../key.pem"),
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
