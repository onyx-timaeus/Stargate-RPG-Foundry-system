

/**
 * Get initiative formula for combatant
 */
 export const _getInitiativeFormula = function() {
    const actor = this.actor;
    if ( !actor ) return "1d20";

    const dexMod = Math.floor((actor.system.attributes.dex.value - 10) / 2);
    const wisMod = Math.floor((actor.system.attributes.wis.value - 10) / 2);
    const init = Math.max(dexMod, wisMod);

    let nd = 1;
    let mods = "";
    const initiativeMode = actor.system.initiativeMode || "normal";

    if (initiativeMode === "advantage") {
      nd = 2;
      mods += "kh";
    } else if (initiativeMode === "disadvantage") {
      nd = 2;
      mods += "kl";
    }

    return `${nd}d20${mods} + ${init}`;
  };