// Image Proxy Edge Function
// Fetches remote images server-side and returns them with permissive CORS headers
// to avoid hotlinking and CORS issues in the client.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function isValidUrl(u: string) {
  try {
    const parsed = new URL(u);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  } catch {
    return false;
  }
}

serve(async (req) => {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');

  if (!target) {
    return new Response('Missing url parameter', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (!isValidUrl(target)) {
    return new Response('Invalid url', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        // Present a generic UA to reduce upstream blocks
        'User-Agent': 'LovableImageProxy/1.0 (+https://lovable.dev)'
      }
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: upstream.status || 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    headers.set('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');

    return new Response(upstream.body, { status: 200, headers });
  } catch (_e) {
    return new Response('Fetch failed', { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});