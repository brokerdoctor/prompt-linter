import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { compile } from '$lib/compiler.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
  const { prompt, apiKey } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'prompt required' }, { status: 400 });
  }

  const key = apiKey || ANTHROPIC_API_KEY;
  if (!key) {
    return json({ error: 'No API key provided and ANTHROPIC_API_KEY not set' }, { status: 400 });
  }

  const passes: object[] = [];
  const result = await compile(prompt, key, (pass) => passes.push(pass));
  return json(result);
};
