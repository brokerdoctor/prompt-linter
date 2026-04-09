import { json } from '@sveltejs/kit';
import { lint } from '$lib/linter.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request }) => {
  const { prompt } = await request.json();
  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'prompt required' }, { status: 400 });
  }
  return json(lint(prompt));
};
