// One-time data migration: item descriptions move to the standard Foundry path
// system.description.value (weapons/equipment/origins: string -> object,
// feats/class abilities: system.bonus -> system.description.value).
const FLAG = "descriptionMigrated";

function updatesFor(item) {
  const src = item._source ?? item.toObject();
  const sys = src.system ?? {};
  const d = sys.description;
  const update = {};
  if ( item.type === "feat" || item.type === "classAbility" ) {
    const hasObj = d && typeof d === "object";
    if ( !hasObj || sys.bonus !== undefined ) {
      const text = (hasObj && d.value) ? d.value : (sys.bonus ?? "");
      update["system.description"] = { value: text };
      if ( sys.bonus !== undefined ) update["system.-=bonus"] = null;
    }
  } else if ( typeof d === "string" ) {
    update["system.description"] = { value: d };
  }
  return update;
}

async function migrateItem(item) {
  const u = updatesFor(item);
  if ( !Object.keys(u).length ) return false;
  // Replace the old string in two steps so the type change is stored cleanly
  const text = u["system.description"]?.value ?? "";
  const del = { "system.-=description": null };
  if ( u["system.-=bonus"] === null ) del["system.-=bonus"] = null;
  await item.update(del, { render: false });
  await item.update({ "system.description": { value: text } }, { render: false });
  return true;
}

export async function migrateDescriptions() {
  if ( !game.user.isGM || game.user !== game.users.activeGM ) return;
  if ( game.settings.get("sgrpg", FLAG) ) return;
  let count = 0;
  const run = async (items) => { for ( const it of items ) { try { if ( await migrateItem(it) ) count++; } catch(e) { console.error("sgrpg | migration failed for", it?.name, e); } } };
  await run(game.items);
  for ( const a of game.actors ) await run(a.items);
  for ( const scene of game.scenes ) for ( const t of scene.tokens ) if ( !t.actorLink && t.actor ) await run(t.actor.items);
  await game.settings.set("sgrpg", FLAG, true);
  if ( count ) ui.notifications.info(`Stargate RPG: migrated ${count} item descriptions to the new format.`);
  console.log(`sgrpg | description migration done, ${count} items`);
}

export function registerMigrationSetting() {
  game.settings.register("sgrpg", FLAG, { scope: "world", config: false, type: Boolean, default: false });
}
