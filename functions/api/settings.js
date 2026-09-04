import { json, fail } from "./_lib.js";

/* 公司資訊（原本的 content/site.json）
   回傳 { company_name: '…', address: '…', address_en: '…', … }
   —— 與舊 site.json 相同的扁平結構，另外多出各語言的 `key_lang` 鍵。 */
export async function onRequest(context) {
  try {
    const { DB } = context.env;

    const [settings, tr] = await Promise.all([
      DB.prepare("SELECT id, key, value FROM settings ORDER BY sort_order, id").all(),
      DB.prepare(
        "SELECT entity_id, lang, value FROM translations WHERE entity = 'setting' AND field = 'value'"
      ).all(),
    ]);

    const out = {};
    const keyById = new Map();
    (settings.results || []).forEach((s) => {
      out[s.key] = s.value;
      keyById.set(String(s.id), s.key);
    });

    (tr.results || []).forEach((t) => {
      const key = keyById.get(String(t.entity_id));
      if (!key) return;
      out[key + "_" + String(t.lang).toLowerCase().replace(/-/g, "_")] = t.value;
    });

    return json(out);
  } catch (error) {
    return fail(error);
  }
}
