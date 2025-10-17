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
    const url = new URL(target);
    const upstream = await fetch(target, {
      headers: {
        // Pretend to be a modern browser to avoid basic bot blocks
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        // Many CDNs validate Referer and sometimes Origin
        'Referer': url.origin,
        'Origin': url.origin,
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: upstream.status || 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      // Upstream gave HTML or something else (likely a bot-check page)
      return new Response('Upstream not an image', { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    headers.set('Content-Type', contentType);
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    headers.set('Referrer-Policy', 'no-referrer');

    return new Response(upstream.body, { status: 200, headers });
  } catch (_e) {
    return new Response('Fetch failed', { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});