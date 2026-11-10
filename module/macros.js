/**
 * Create a macro from an item drop
 * @param {Object} data
 * @param {number} slot
 * @returns {Promise}
 */
 export async function createSgMacro(data, slot) {
    if ( data.type !== "Item" ) return;
    if (!( "data" in data ) ) return ui.notifications.warn("You can only create macro buttons for owned Items");
    const item = data.data;

    const command = `game.sgrpg.rollItemMacro("${item.name}");`;
    let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
    if ( !macro ) {
      macro = await Macro.create({
        name: item.name,
        type: "script",
        img: item.img,
        command: command,
        flags: {"sgrpg.itemMacro": true}
      });
    }

    game.user.assignHotbarMacro(macro, slot);
    return false;
  }

  /**
   * Roll an item from a macro
   * @param {string} itemName
   * @return {Promise}
   */
  export function rollItemMacro(itemName) {
    const speaker = ChatMessage.getSpeaker();
    let actor;
    if ( speaker.token ) {
      const token = canvas.tokens.get(speaker.token);
      actor = token?.actor;
    }
    if ( !actor ) actor = game.actors.get(speaker.actor);

    const items = actor ? actor.items.filter(i => i.name === itemName) : [];
    if ( items.length > 1 ) {
      ui.notifications.warn(`Your controlled Actor ${actor.name} has more than one Item with name ${itemName}. The first matched item will be chosen.`);
    } else if ( items.length === 0 ) {
      return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);
    }
    const item = items[0];

    return item.roll();
  }
