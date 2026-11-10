import WeaponSelector from "../../apps/weapon-selector.js";
import InventorySelector from "../../apps/inventory-selector.js";

export default class SGActorSheet extends ActorSheet {
    static DEFAULT_SKILL_MODS = {
        acrobatics: "dex",
        animalhandling: "wis",
        athletics: "str",
        culture: "wis",
        deception: "cha",
        engineering: "int",
        history: "int",
        insight: "wis",
        intimidation: "cha",
        investigation: "int",
        medicine: "wis",
        nature: "int",
        perception: "wis",
        performance: "cha",
        persuasion: "cha",
        pilot: "dex",
        science: "int",
        sleight: "dex",
        stealth: "dex",
        survival: "wis"
    };

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet", "actor", "sgrpg"],
            width: 875,
            height: 900,
            tabs: [{navSelector: ".tabs", contentSelector: ".sg-sheet-body", initial: "character"}]
        });
    }

    get template() {
        return `systems/sgrpg/templates/sheets/${this.actor.type}-sheet.hbs`;
    }

    /** @override */
    async _render(force, options) {
        const scrollPos = this.element?.find('.sg-sheet-body')?.scrollTop() || 0;
        const inventoryScrollPos = this.element?.find('.inventory-table-wrapper')?.scrollTop() || 0;

        await super._render(force, options);

        if (scrollPos > 0) {
            this.element.find('.sg-sheet-body').scrollTop(scrollPos);
        }
        if (inventoryScrollPos > 0) {
            this.element.find('.inventory-table-wrapper').scrollTop(inventoryScrollPos);
        }
    }

    /**
     * Prepare character-specific data
     */
    _prepareCharacterData(actorData) {
        const data = actorData.system;

        // Calculate ability modifiers
        for (let [key, ability] of Object.entries(data.attributes)) {
            ability.mod = Math.floor((ability.value - 10) / 2);
            ability.modDisplay = ability.mod >= 0 ? `+${ability.mod}` : `${ability.mod}`;
        }

        const dexMod = data.attributes.dex?.mod || 0;
        const wisMod = data.attributes.wis?.mod || 0;
        data.initiative = Math.max(dexMod, wisMod);

        const intMod = data.attributes.int?.mod || 0;
        const chaMod = data.attributes.cha?.mod || 0;
        data.moxie = Math.max(intMod, chaMod);
    }

    getData(options) {
        let isOwner = this.actor.isOwner;

        const data = {
          owner: isOwner,
          limited: this.actor.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          isCharacter: this.actor.type === "character",
          isNPC: this.actor.type === "npc",
          isGM: game.user.isGM,
          rollData: this.actor.getRollData.bind(this.actor),
        };

        const actorData = this.actor.toObject(false);
        data.actor = actorData;
        data.system = actorData.system;
        data.data = actorData.system;

        this._prepareCharacterData(actorData);

        data.system.tensionDie = game.sgrpg.getTensionDie();
        data.data.tensionDie = game.sgrpg.getTensionDie();

        if (data.system.skills && data.system.skills.undefined) {
            delete data.system.skills.undefined;
        }

        data.items = actorData.items;
        for ( let iData of data.items ) {
          const item = this.actor.items.get(iData._id);
          iData.hasAmmo = item.consumesAmmunition;
          iData.labels = item.labels;

          if (iData.type === 'weapon') {
            const attackAbility = iData.system.attackAbility || 'dex';
            const abilityMod = data.system.attributes[attackAbility]?.mod || '+0';

            const profType = iData.system.profType;
            let isProficient = false;
            if (profType && profType !== 'none' && data.system.proficiencies?.weapon) {
              const profMap = {
                'commonWeapons': 'common',
                'grenades': 'grenades',
                'jaffaWeapons': 'jaffa',
                'longarms': 'longarms',
                'martialArts': 'martialArts',
                'shotguns': 'shotguns',
                'sidearms': 'sidearms'
              };
              const actorProfField = profMap[profType];
              isProficient = actorProfField && data.system.proficiencies.weapon[actorProfField] === true;
            }

            const profBonus = isProficient ? parseInt(data.system.prof) : 0;

            const abilityNum = parseInt(abilityMod);
            let totalToHit = abilityNum + profBonus;

            // Handle attackBonus
            let bonusDisplay = "";
            if (iData.system.attackBonus && iData.system.attackBonus.trim() !== "") {
              const bonus = iData.system.attackBonus.trim();
              // Check if it's a pure number
              const numericBonus = parseInt(bonus);
              if (!isNaN(numericBonus) && !bonus.match(/d\d+/i)) {
                // It's a numeric bonus, add it to totalToHit
                totalToHit += numericBonus;
              } else {
                // It's a dice roll or complex formula, show it separately
                bonusDisplay = bonus.startsWith('+') || bonus.startsWith('-') ? bonus : `+${bonus}`;
              }
            }

            iData.calculatedToHit = (totalToHit >= 0 ? `+${totalToHit}` : totalToHit.toString()) + bonusDisplay;
          }
        }
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this._prepareItemData(data);
        this._prepare_proficient_skills(data);

        data.config = foundry.utils.mergeObject(CONFIG.SGRPG, {
            conditions: {
                normal: "Normal",
                disadvabilitychecks: "Disadv ability checks",
                speedhalved: "Speed halved",
                disadvattackssaves: "Disadv attacks, saves",
                hpmaxhalved: "HP max halved",
                speedzero: "Speed zero",
                death: "Death"
            },
            saves: CONFIG.SGRPG.abilities
        });

        return data;
    }

    /**
     * Activate event listeners
     * @param html {jQuery}
     */
    activateListeners(html) {
        super.activateListeners(html);
        if ( ! this.isEditable ) return;

        html.find('a.txt-btn[type="roll"]').click(event => this._onRollCheck(event));
        html.find('a.txt-btn[type="roll_init"]').click(event => this._roll_initiative(event));
        html.find('a.txt-btn[type="roll_moxie"]').click(event => this._roll_moxie(event));
        html.find('a[type="roll_attack"]').click(event => this._roll_attack(event));

        html.find('[data-action="rollTD"]').click(event => this._onRollTensionDie(event));
        html.find('[data-action="rollHD"]').click(event => this._onRollHitDice(event));
        html.find('[data-action="rollDeathSave"]').click(event => this._onRollDeathSave(event));
        html.find('input[name="sgStatus"]').change(event => this._onSetStatus(event));
        html.find('img.pt-image').click(event => this._onPickImage(event));
        html.find('[data-action="addWeapon"]').click(event => this._onAddWeapon(event));
        html.find('[data-action="addInventory"]').click(event => this._onAddItem(event));

        html.find('input[data_type="ability_value"]').change(this._onChangeAbilityValue.bind(this));
        html.find('input[data_type="skill_prof"]').click(event => this._onToggleSkillProficiency(event));
        html.find('input[name="system.prof"]').change(event => this._onProfChanged(event));
        html.find('select[data_type="skill_mod"]').change(event => this._onChangeSkillMod(event));
        html.find('a.skill-mod-revert').click(event => this._onSkillRestoreDefaultModClicked(event));

        html.find('.item-consume').click(event => this._onItemConsume(event));
        html.find('.item-edit').click(event => this._onItemEdit(event));
        html.find('.item-delete').click(event => this._onItemDelete(event));
        html.find('.item-roll').click(event => this._onItemRoll(event));
        html.find('.item-reload').click(event => this._onItemReload(event));


        // Collapsible section toggle for Origin Abilities
        html.find('.collapsible-header').click(event => this._onToggleSection(event));

        // Damage resistance cycling (NPC only)
        html.find('.damage-resistance-btn').click(event => this._onCycleDamageResistance(event));
    }

    _onToggleSection(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const section = header.closest('.abilities-section');
        const grid = section.querySelector('.abilities-grid-collapsible');

        if (grid) {
            grid.classList.toggle('collapsed');
            header.classList.toggle('collapsed');
        }
    }

    async _onCycleDamageResistance(event) {
        event.preventDefault();
        event.stopPropagation();

        const button = event.currentTarget;
        const damageType = button.dataset.damageType;

        console.log("Cycling damage resistance:", damageType);

        // Initialize damageResistances if it doesn't exist
        if (!this.actor.system.damageResistances) {
            await this.actor.update({
                "system.damageResistances": {
                    "piercing": "normal",
                    "bludgeoning": "normal",
                    "slashing": "normal",
                    "fire": "normal",
                    "lightning": "normal",
                    "cold": "normal",
                    "acid": "normal",
                    "poison": "normal",
                    "force": "normal",
                    "radiant": "normal",
                    "necrotic": "normal",
                    "psychic": "normal",
                    "sonic": "normal",
                    "explosive": "normal"
                }
            });
        }

        // Get current state from actor data
        const currentState = this.actor.system.damageResistances?.[damageType] || "normal";

        // Cycle through states: normal → resistant → vulnerable → immune → normal
        let newState;
        switch (currentState) {
            case "normal":
                newState = "resistant";
                break;
            case "resistant":
                newState = "vulnerable";
                break;
            case "vulnerable":
                newState = "immune";
                break;
            case "immune":
                newState = "normal";
                break;
            default:
                newState = "normal";
        }

        console.log(`Changing ${damageType} from ${currentState} to ${newState}`);

        // Update the actor data
        await this.actor.update({
            [`system.damageResistances.${damageType}`]: newState
        });
    }

    async _onSkillRestoreDefaultModClicked(event) {
        event.preventDefault();
        const skillName = event.currentTarget.parentElement.dataset.skill;

        if (!skillName) {
            console.error("Skill name not found", event.currentTarget);
            return;
        }

        const defaultSkillMod = SGActorSheet.DEFAULT_SKILL_MODS[skillName];

        if (!defaultSkillMod) {
            console.error(`No default mod found for skill: ${skillName}`);
            return;
        }

        await this.actor.update({ [`system.skills.${skillName}.mod`]: defaultSkillMod });

        const skillUpdates = this._compileSkillValues();
        return this.actor.update(skillUpdates);
    }

    /** @override */
    async _onDropItemCreate(itemData) {
        if ( itemData.type === "equip" && itemData.flags.core?.sourceId ) {
            const similarItem = this.actor.items.find(i => {
                const sourceId = i.getFlag("core", "sourceId");
                return sourceId && (sourceId === itemData.flags.core?.sourceId) && (i.type === "equip");
            });
            if ( similarItem ) {
                return similarItem.update({
                    'system.quantity': similarItem.system.quantity + Math.max(itemData.system.quantity, 1)
                });
            }
        }

        return super._onDropItemCreate(itemData);
    }

    _prepareItemData(data) {
        let inventory = {
            weapon: [],
            equip: [],
            origin: [],
            classAbility: [],
            feat: []
        };

        let curBulk = 0;
        for(const item of data.items) {
            if(! Object.keys(inventory).includes(item.type)) {
                console.error("Unknown item type:", item.type);
                continue;
            }

            item.isStack = Number.isNumeric(item.system.quantity) && (item.system.quantity !== 1);

            const itemQuantity = Number.isNumeric(item.system.quantity) ? item.system.quantity : 1;
            item.isInactive = itemQuantity <= 0;

            if (!item.isInactive) {
                const itemBulk = item.system.bulk || 0;
                const itemCount = (item.isStack ? item.system.quantity : 1);
                curBulk += itemBulk * itemCount;
                if (item.type == "weapon" && item.system.ammo) {
                    const ammoBulk = item.system.ammo.bulk;
                    const ammoCount = item.system.ammo.value;
                    curBulk += ammoBulk * ammoCount;
                }
            }

            inventory[item.type].push(item);
        }
        curBulk = Math.ceil(curBulk);

        const maxBulk = data.data.bulk + parseInt(data.data.attributes.str.mod);

        data.items = inventory;
        data.currentBulk = curBulk;
        data.currentBulkPerc = Math.min((curBulk / maxBulk) * 100, 100);
        data.isOverloaded = curBulk > maxBulk;
        data.maxBulk = maxBulk;
    }


    _prepare_proficient_skills(data) {
        data.proficient_skills = {};
        for(const skill_id in data.data.skills) {
            const skill = data.data.skills[skill_id];
            if (skill.proficient) {
                data.proficient_skills[skill_id] = foundry.utils.deepClone(skill);
            }
        }
    }

    async _onChangeAbilityValue(event) {
        event.preventDefault();
        const newAttrVal = parseInt(event.currentTarget.value);
        const attrName = event.currentTarget.parentElement.dataset.attr;

        await this.actor.update({
            [`system.attributes.${attrName}.mod`]: this._calculateAttributeMod(newAttrVal),
            [`system.attributes.${attrName}.value`]: newAttrVal
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onProfChanged(event) {
        event.preventDefault();
        const newProf = parseInt(event.currentTarget.value);

        await this.actor.update({
            "system.prof": newProf
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onToggleSkillProficiency(event) {
        event.preventDefault();
        const cb = event.currentTarget;

        await this.actor.update({[cb.name]: cb.checked == true }, {render: false});
        return this.actor.update(this._compileSkillValues());
    }

    async _onChangeSkillMod(event) {
        event.preventDefault();
        const select = event.currentTarget;

        await this.actor.update({[select.name]: select.value }, {render: false});
        return this.actor.update(this._compileSkillValues());
    }

    _compileSkillValues() {
        const actorData = this.getData();
        const skillList = foundry.utils.getProperty(actorData, "system.skills");
        const savesList = foundry.utils.getProperty(actorData, "system.saves");
        const currentProfValue = parseInt(foundry.utils.getProperty(actorData, "system.prof"));

        let modify = {};
        for(const skillName in skillList) {
            const skill = skillList[skillName]
            const skillModName = foundry.utils.getProperty(actorData, `system.skills.${skillName}.mod`);
            let baseVal = parseInt(foundry.utils.getProperty(actorData, `system.attributes.${skillModName}.mod`));
            if (skill.proficient) {
                baseVal += currentProfValue;
            }
            modify[`system.skills.${skillName}.value`] = baseVal.toString();
        }

        for(const saveName in savesList) {
            const save = savesList[saveName]
            const saveModName = foundry.utils.getProperty(actorData, `system.saves.${saveName}.mod`);
            let baseVal = parseInt(foundry.utils.getProperty(actorData, `system.attributes.${saveModName}.mod`));
            if (save.proficient) {
                baseVal += currentProfValue;
            }
            modify[`system.saves.${saveName}.value`] = baseVal.toString();
        }


        return modify;
    }

    /**
     * Handle editing an item
     * @param {Event} event
     * @private
     */
    _onItemEdit(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.sheet.render(true);
    }

    _onItemConsume(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.consume();
    }

    async _onItemReload(event) {
        event.preventDefault();
        const row = event.currentTarget.closest('tr.item');
        const item = this.actor.items.get(row.dataset.itemId);

        if (item.system.ammo.value == item.system.ammo.max) {
            return ui.notifications.info("Weapon is already reloaded.");
        }

        // Allow free reload for weapons with magazine (ammo.value and ammo.max set)
        return item.update({"system.ammo.value": item.system.ammo.max});
    }

    /**
     * Handle deleting an item
     * @param {Event} event
     * @private
     */
    _onItemDelete(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);

        if (confirm(`Do you really want to delete '${item.name}' from inventory?`) !== true) {
            return;
        }

        if ( item ) return item.delete();
    }

    _onItemRoll(event) {
        event.preventDefault();
        const row = event.currentTarget.closest('tr.item');
        const item = this.actor.items.get(row.dataset.itemId);
        if ( item ) return item.roll()
    }

    /**
     * Handle rolling a skill or save
     * @param {Event} event
     * @private
     */
     async _onRollCheck(event) {
        event.preventDefault();

        let actorData = this.getData();
        let bonusDataPath = event.currentTarget.dataset.bonus;

        let rollData = parseInt(foundry.utils.getProperty(actorData, bonusDataPath));
        if (rollData >= 0) {
            rollData = "+" + rollData;
        }

        let flavorText = event.currentTarget.innerText;
        if (bonusDataPath.includes(".saves.")) {
            flavorText = `${flavorText} Saving Throw`;
        }

        let r = new CONFIG.Dice.D20Roll("1d20 @prof", {prof: rollData});
        const configured = await r.configureDialog({
            title: `Roll check for ${event.currentTarget.innerText}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: flavorText
        });
    }

    /** Pick a new portrait or prototype token image from the Configuration tab. */
    _onPickImage(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const FP = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
        const current = foundry.utils.getProperty(this.actor._source, field);
        new FP({
            type: "image",
            current,
            callback: path => this.actor.update({[field]: path})
        }).browse();
    }

    /** Manually switch the character between alive and dead (e.g. after a resurrection). */
    async _onSetStatus(event) {
        event.preventDefault();
        event.stopPropagation();
        const dead = event.currentTarget.value === "dead";
        const wasDead = this.actor.system.condition === "death";
        if ( dead === wasDead ) return;
        const updates = {"system.condition": dead ? "death" : "normal"};
        if ( !dead ) {
            for ( let n = 1; n <= 3; n++ ) {
                updates[`system.death_success${n}`] = false;
                updates[`system.death_failure${n}`] = false;
            }
        }
        await this.actor.update(updates);
    }

    async _onRollDeathSave(event) {
        event.preventDefault();

        let r = new Roll("1d20");
        await r.evaluate();
        const rollResult = r.total;

        const system = this.actor.system;
        const curSuccesses = [system.death_success1, system.death_success2, system.death_success3].filter(Boolean).length;
        const curFailures = [system.death_failure1, system.death_failure2, system.death_failure3].filter(Boolean).length;
        const curHealth = parseInt(system.health.value);

        const updates = {};
        let isDeath = false;
        let isAlive = false;

        if (rollResult == 1) {
            // NAT1 counts as 2 failures
            if (curFailures === 0) {
                updates["system.death_failure1"] = true;
                updates["system.death_failure2"] = true;
            } else if (curFailures === 1) {
                if (!system.death_failure2) updates["system.death_failure2"] = true;
                if (!system.death_failure3) updates["system.death_failure3"] = true;
                updates["system.condition"] = "death";
                isDeath = true;
            } else if (curFailures === 2) {
                if (!system.death_failure3) updates["system.death_failure3"] = true;
                updates["system.condition"] = "death";
                isDeath = true;
            }
        }
        else if (rollResult == 20) {
            // NAT20 counts as 2 successes (not instant revival)
            if (curSuccesses === 0) {
                updates["system.death_success1"] = true;
                updates["system.death_success2"] = true;
            } else if (curSuccesses === 1) {
                updates["system.death_success2"] = true;
                updates["system.death_success3"] = true;
                // 3 successes reached - trigger revival
                updates["system.death_success1"] = false;
                updates["system.death_success2"] = false;
                updates["system.death_success3"] = false;
                updates["system.death_failure1"] = false;
                updates["system.death_failure2"] = false;
                updates["system.death_failure3"] = false;
                isAlive = true;
            } else if (curSuccesses >= 2) {
                // Already have 2+ successes, adding 2 more means revival
                updates["system.death_success1"] = false;
                updates["system.death_success2"] = false;
                updates["system.death_success3"] = false;
                updates["system.death_failure1"] = false;
                updates["system.death_failure2"] = false;
                updates["system.death_failure3"] = false;
                isAlive = true;
            }
        }
        else if (rollResult >= 10) {
            if (curSuccesses === 0) {
                updates["system.death_success1"] = true;
            } else if (curSuccesses === 1) {
                updates["system.death_success2"] = true;
            } else if (curSuccesses === 2) {
                updates["system.death_success1"] = false;
                updates["system.death_success2"] = false;
                updates["system.death_success3"] = false;
                updates["system.death_failure1"] = false;
                updates["system.death_failure2"] = false;
                updates["system.death_failure3"] = false;
                isAlive = true;
            }
        }
        else {
            if (curFailures === 0) {
                updates["system.death_failure1"] = true;
            } else if (curFailures === 1) {
                updates["system.death_failure2"] = true;
            } else if (curFailures === 2) {
                updates["system.death_failure3"] = true;
                updates["system.condition"] = "death";
                isDeath = true;
            }
        }

        // Death saves are only visible (and audible) to the GM and the players owning this actor
        const recipients = game.users
            .filter(u => u.isGM || this.actor.testUserPermission(u, "OWNER"))
            .map(u => u.id);

        const message = await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Death Save",
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: [r],
            sound: CONFIG.sounds.dice,
            whisper: recipients
        });

        // Wait for the 3D dice animation (Dice So Nice) before revealing the outcome
        try { await game.dice3d?.waitFor3DAnimationByMessageID(message.id); } catch(e) {}

        if (Object.keys(updates).length > 0) {
            await this.actor.update(updates);
        }

        if (isDeath) {
            AudioHelper.play({
                src: "systems/sgrpg/assets/sounds/gate-close.mp3",
                volume: 0.35,
                autoplay: true,
                loop: false
            }, {recipients});
        }

        if (isAlive) {
            AudioHelper.play({
                src: "systems/sgrpg/assets/sounds/alive.mp3",
                volume: 0.35,
                autoplay: true,
                loop: false
            }, {recipients});
        }
    }

    async _roll_initiative(event) {
        event.preventDefault();

        // Get all tokens for this actor
        const tokens = this.actor.getActiveTokens();

        if (tokens.length === 0) {
            ui.notifications.warn("No token found for this actor on the current scene!");
            return;
        }

        // Use the first token (or we could let user choose if multiple)
        const token = tokens[0];

        // Check if there's an active combat
        let combat = game.combat;

        if (!combat) {
            // Create a new combat encounter
            combat = await game.combats.documentClass.create({
                scene: canvas.scene.id,
                active: true
            });
        }

        // Check if this token is already in combat
        let combatant = combat.combatants.find(c => c.tokenId === token.id);

        if (!combatant) {
            // Add the token to combat
            const combatantData = await combat.createEmbeddedDocuments("Combatant", [{
                tokenId: token.id,
                sceneId: canvas.scene.id,
                actorId: this.actor.id,
                hidden: token.document.hidden
            }]);
            combatant = combatantData[0];
        }

        // Roll initiative for the combatant
        if (combatant) {
            await combat.rollInitiative([combatant.id]);
        }
    }

    async _roll_moxie(event) {
        event.preventDefault();

        const intMod = Math.floor((this.actor.system.attributes.int.value - 10) / 2);
        const chaMod = Math.floor((this.actor.system.attributes.cha.value - 10) / 2);
        const moxie = Math.max(intMod, chaMod);

        let nd = 1;
        let mods = "";
        const moxieMode = this.actor.system.moxieMode || "normal";

        if (moxieMode === "advantage") {
            nd = 2;
            mods += "kh";
        } else if (moxieMode === "disadvantage") {
            nd = 2;
            mods += "kl";
        }

        const formula = `${nd}d20${mods} + ${moxie}`;

        let r = new Roll(formula);
        await r.evaluate();

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Moxie Roll"
        });
    }

    /**
     * Roll the tension die
     * @param {Event} event
     * @private
     */
    async _onRollTensionDie(event) {
        event.preventDefault();
        const tensionDie = this.actor.system.tensionDie || "d6";

        let r = new Roll(`1${tensionDie}`);
        await r.evaluate();

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `Tension Die (${tensionDie})`
        });
    }

    /**
     * Roll hit dice
     * @param {Event} event
     * @private
     */
    async _onRollHitDice(event) {
        event.preventDefault();
        const hitDice = this.actor.system.hd || "d6";

        let r = new Roll(`1${hitDice}`);
        await r.evaluate();

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `Hit Dice (${hitDice})`
        });
    }

    /**
     * Handle config menu button clicks
     * @param {Event} event
     * @private
     */

    /**
     * Open item selector dialog
     * @param {Event} event
     * @private
     */
    _onAddItem(event) {
        event.preventDefault();
        const selector = new InventorySelector(this.actor);
        selector.render(true);
    }

    /**
     * Open weapon selector dialog
     * @param {Event} event
     * @private
     */
    _onAddWeapon(event) {
        event.preventDefault();
        const selector = new WeaponSelector(this.actor);
        selector.render(true);
    }

    /**
     * Calculate attribute modifier from value
     * @param value
     * @private
     */
     _calculateAttributeMod(value) {
        const stat_base = value

        let stat_mod = 0;
        if (stat_base >= 30) stat_mod = "+10";
        else if (stat_base >= 28) stat_mod = "+9";
        else if (stat_base >= 26) stat_mod = "+8";
        else if (stat_base >= 24) stat_mod = "+7";
        else if (stat_base >= 22) stat_mod = "+6";
        else if (stat_base >= 20) stat_mod = "+5";
        else if (stat_base >= 18) stat_mod = "+4";
        else if (stat_base >= 16) stat_mod = "+3";
        else if (stat_base >= 14) stat_mod = "+2";
        else if (stat_base >= 12) stat_mod = "+1";
        else if (stat_base >= 10) stat_mod = "+0";
        else if (stat_base >= 8) stat_mod = "-1";
        else if (stat_base >= 6) stat_mod = "-2";
        else if (stat_base >= 4) stat_mod = "-3";
        else if (stat_base >= 2) stat_mod = "-4";
        else if (stat_base <= 1) stat_mod = "-5";
        else stat_mod = "+0";

        return stat_mod;
    }
}