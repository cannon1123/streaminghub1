export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/data") {
      const res = await fetch(env.SUPABASE_URL + "/rest/v1/series?select=*", {
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`
        }
      });

      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("OK");
  }
};
