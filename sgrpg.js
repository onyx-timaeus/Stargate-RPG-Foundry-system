import { SGRPG } from "./module/config.js";

import "./module/scene-config.js";

import "./module/externals.js"; // Setup external module integrations

import ItemSg from "./module/item/entity.js"
import ActorSg from "./module/actor/entity.js"

import SGItemSheet from "./module/item/sheet/itemSheet.js";
import SGOriginSheet from "./module/item/sheet/originSheet.js";
import SGClassAbilitySheet from "./module/item/sheet/classAbilitySheet.js";
import SGFeatSheet from "./module/item/sheet/featSheet.js";
import SGActorSheet from "./module/actor/sheet/actorSheet.js";

import D20Roll from "./module/dice/d20-roll.js";
import DamageRoll from "./module/dice/damage-roll.js"

import * as chat from "./module/chat.js"
import * as macros from "./module/macros.js"
import { _getInitiativeFormula } from "./module/combat.js";
import { preloadHandlebarsTemplates } from "./module/templates.js";
import { migrateDescriptions, registerMigrationSetting } from "./module/migrate.js";

Hooks.once("init", function(){
    game.settings.register("sgrpg", "autoApplyDamage", {
        name: "Apply damage to targeted tokens",
        hint: "When a damage roll is made while tokens are targeted (T key), their HP is reduced automatically, including resistance, vulnerability and immunity.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    console.log("Initializing StarGate systems");

    CONFIG.SGRPG = SGRPG;

    game.sgrpg = {
        config: SGRPG,
        rollItemMacro: macros.rollItemMacro,
        getTensionDie
    };

    CONFIG.Item.documentClass = ItemSg;
    CONFIG.Actor.documentClass = ActorSg;

    console.log("Available Item types:", CONFIG.Item.documentClass.TYPES);

    // 5e cone RAW should be 53.13 degrees
    CONFIG.MeasuredTemplate.defaults.angle = 53.13;

    CONFIG.Dice.D20Roll = D20Roll;
    CONFIG.Dice.DamageRoll = DamageRoll;
    CONFIG.Dice.rolls.push(D20Roll);
    CONFIG.Dice.rolls.push(DamageRoll);

    CONFIG.Combat.initiative.formula = "1d20 + @initiative";
    Combatant.prototype._getInitiativeFormula = _getInitiativeFormula;

    // Use DocumentSheetConfig for v13+ compatibility
    DocumentSheetConfig.unregisterSheet(Item, "core", ItemSheet);
    DocumentSheetConfig.registerSheet(Item, "sgrpg", SGItemSheet, {makeDefault: true});
    DocumentSheetConfig.registerSheet(Item, "sgrpg", SGOriginSheet, {
        types: ["origin"],
        makeDefault: true,
        label: "Origin Sheet"
    });
    console.log("Registered Origin sheet for item type: origin");

    DocumentSheetConfig.registerSheet(Item, "sgrpg", SGClassAbilitySheet, {
        types: ["classAbility"],
        makeDefault: true,
        label: "Class Ability Sheet"
    });
    console.log("Registered Class Ability sheet for item type: classAbility");

    DocumentSheetConfig.registerSheet(Item, "sgrpg", SGFeatSheet, {
        types: ["feat"],
        makeDefault: true,
        label: "Feat Sheet"
    });
    console.log("Registered Feat sheet for item type: feat");

    DocumentSheetConfig.unregisterSheet(Actor, "core", ActorSheet);
    DocumentSheetConfig.registerSheet(Actor, "sgrpg", SGActorSheet, {makeDefault: true});


    game.settings.register("sgrpg", "campaignTension", {
        name: "Campaign Tension Level",
        hint: "Set the campaign's base Tension level and the Tension Die.",
        scope: "world",
        type: String,
        choices: SGRPG.tensionDice,
        default: SGRPG.defaultTensionDie,
        config: true
    });

    // Register Handlebars helpers
    Handlebars.registerHelper('range', function(n) {
        const count = parseInt(n);
        if (isNaN(count) || count <= 0) return [];
        return Array.from({length: count}, (_, i) => i);
    });

    Handlebars.registerHelper('isNumeric', function(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    });

    registerMigrationSetting();

    preloadHandlebarsTemplates()
});

Hooks.once("ready", function() {
    console.log("Registering StarGate systems");
    migrateDescriptions();

    // Register hotbar drop hook after modules initialize
    Hooks.on("hotbarDrop", (bar, data, slot) => macros.createSgMacro(data, slot));
});



// Actors set to "whisper rolls" only show their rolls to the GM and the actor's owners
// Apply a damage roll to the tokens that were targeted (done once, by the active GM)
Hooks.on("createChatMessage", async (message) => {
    const d = message.flags?.sgrpg?.damage;
    if ( !d?.targets?.length ) return;
    // One client applies it: the active GM, or the roller if no GM is connected
    const gm = game.users.activeGM;
    const mine = gm ? gm.id === game.user.id : message.author?.id === game.user.id;
    console.log(`sgrpg | damage message, targets: ${d.targets.length}, active GM: ${gm?.name ?? "none"}, this client applies: ${mine}`);
    if ( !mine ) return;
    const multipliers = { normal: 1, resistant: 0.5, vulnerable: 2, immune: 0 };
    const applied = [];
    for ( const uuid of d.targets ) {
        try {
            const token = await fromUuid(uuid);
            const actor = token?.actor;
            if ( !actor ) { console.warn("sgrpg | damage target not found", uuid); continue; }
            const key = d.type === "electricity" ? "lightning" : d.type;
            const state = actor.system.damageResistances?.[key] ?? "normal";
            const mult = multipliers[state] ?? 1;
            await actor.applyDamage(d.total, mult);
            applied.push({ name: token.name, amount: Math.floor(d.total * mult), state });
        } catch(err) {
            console.error("sgrpg | applying damage failed", err);
            ui.notifications.error(`Could not apply damage: ${err.message}`);
        }
    }
    if ( applied.length ) await message.setFlag("sgrpg", "applied", applied);
});

// Keep the prototype token name in step with the actor name when the actor is renamed
Hooks.on("preUpdateActor", (actor, changes) => {
    if ( typeof changes.name !== "string" || changes.name === actor.name ) return;
    foundry.utils.setProperty(changes, "prototypeToken.name", changes.name);
});

Hooks.on("preCreateChatMessage", (message, data) => {
    if ( message.whisper?.length ) return;
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    if ( !actor?.system?.whisperRolls ) return;
    const isRoll = message.rolls?.length || /attack-card/.test(message.content ?? "");
    if ( !isRoll ) return;
    const recipients = game.users
        .filter(u => u.isGM || actor.testUserPermission(u, "OWNER"))
        .map(u => u.id);
    message.updateSource({whisper: recipients});
});

// Use v13+ hook for rendering chat messages
Hooks.on("renderChatMessageHTML", (app, html, data) => {
    // Handle both jQuery and HTMLElement for compatibility
    const element = html instanceof HTMLElement ? html : html[0];
    chat.highlightCriticalSuccessFailure(app, element, data);
    chat.buildRollCard(app, element);
    chat.buildItemCard(app, element);
    chat.addPortrait(app, element);
});
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatLog", (app, html, data) => ItemSg.chatListeners(html));
Hooks.on("renderChatPopout", (app, html, data) => ItemSg.chatListeners(html));
Hooks.on("renderChatMessage", (app, html, data) => ItemSg.chatListeners(html));


/** Returns the current Tension Die, either from the base campaign level, or the currently active scene level if overridden there
 * @returns {string} The current Tension Die
 */
function getTensionDie() {
    // Get Tension Die from active scene, or campaign if not set
    return game.scenes.active?.getFlag("sgrpg", "sceneTensionDie") || game.settings.get("sgrpg", "campaignTension");
}