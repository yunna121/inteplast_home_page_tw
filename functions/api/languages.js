import { json, fail } from "./_lib.js";

export async function onRequest(context) {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT code, label, is_base, sort_order FROM languages ORDER BY sort_order, code"
    ).all();
    return json(results || []);
  } catch (error) {
    return fail(error);
  }
}
