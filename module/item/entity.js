

export default class ItemSg extends Item {

    /** @override */
    static TYPES = ["weapon", "equip", "origin", "classAbility", "feat"];

    /**
     * Check if item has an attack roll
     * @type {boolean}
     */
    get hasAttack() {
        return typeof this.system.attackAbility === "string";
    }

    get consumesAmmunition() {
        if (! this.system.ammo) {
            return false;
        }
        return this.system.ammo.value !== null && Number.isNumeric(this.system.ammo.max);
    }

    async roll() {
        // For weapons, roll attack directly instead of showing card
        if (this.hasAttack) {
            return this.rollAttack();
        }
        this.displayCard();
    }

    async rollAttack() {
        const hasAmmo = this.system.ammo.value !== null;

        if (! this.actor) {
            return ui.notifications.warn("You can only roll for owned items!");
        }

        if (hasAmmo && parseInt(this.system.ammo.value) == 0) {
            return ui.notifications.warn("No more ammo for this item!");
        }

        const abilityName = this.system.attackAbility;
        const abilityMod = parseInt(this.actor.system.attributes[abilityName].mod);

        const profType = this.system.profType;
        let isProficient = false;
        if (profType && profType !== 'none' && this.actor.system.proficiencies?.weapon) {
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
            isProficient = actorProfField && this.actor.system.proficiencies.weapon[actorProfField] === true;
        }

        let rollMacro = "1d20";
        if (parseInt(abilityMod) != 0) {
            rollMacro += " + " + abilityMod;
        }
        if (isProficient) {
            rollMacro += " + " + this.actor.system.prof;
        }
        if (this.system.attackBonus && this.system.attackBonus.trim() !== "") {
            const bonus = this.system.attackBonus.trim();
            // If bonus doesn't start with + or -, add a +
            if (!bonus.startsWith('+') && !bonus.startsWith('-')) {
                rollMacro += " + " + bonus;
            } else {
                rollMacro += " " + bonus;
            }
        }

        const r = new CONFIG.Dice.D20Roll(rollMacro, this.actor.system);
        const configured = await r.configureDialog({
            title: `Attack by ${this.name}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        // Consume ammo if item uses it
        if (hasAmmo) {
            const remainingAmmo = parseInt(this.system.ammo.value);
            if (remainingAmmo <= 0) {
                // Verify ammo count hasn't changed
                return ui.notifications.warn("No more ammo for this item!");
            }
            await this.update({"system.ammo.value": remainingAmmo - 1});
        }

        let specialHtml = '';
        if (this.system.details.special) {
            specialHtml = `<div class="weapon-special">${this.system.details.special}</div>`;
        }
        const token = this.actor.token;
        const rollHtml = await r.render();

        const wRange = this.system.details?.range?.normal;
        const wMeta = wRange ? `${wRange}m` : "";
        const cardHtml = `
            <div class="sgrpg chat-card attack-card" data-actor-id="${this.actor.id}"${this.actor.isToken ? ` data-token-id="${this.actor.token?.uuid}"` : ""} data-item-id="${this._id}">
                <header class="card-header">
                    <img src="${this.img}" width="64" height="64"/>
                    <div class="sg-weapon"><h3>${this.name}</h3>${wMeta ? `<div class="sg-weapon-meta">${wMeta}</div>` : ""}</div>
                </header>
                <div class="attack-roll-result">
                    ${rollHtml}
                </div>
                ${specialHtml}
                <div class="card-buttons">
                    <button data-action="damage"><i class="fas fa-dice-d20"></i> Roll Damage</button>
                </div>
            </div>
        `;

        let soundPath = null;
        if (this.system.atkSnd) {
            const resp = await fetch(this.system.atkSnd, { method: 'HEAD' });
            if (resp.ok) {
                soundPath = this.system.atkSnd;
            } else {
                ui.notifications.warn("Attack sound path for " + this.name + " could not be resolved: " + this.system.atkSnd);
            }
        }

        const messageData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: [r],
            content: cardHtml,
            speaker: ChatMessage.getSpeaker({ actor: this.actor, token }),
            sound: soundPath || CONFIG.sounds.dice,
            flags: {"core.canPopout": true}
        };

        ChatMessage.applyRollMode(messageData, r.options.rollMode || game.settings.get("core", "rollMode"));

        return ChatMessage.create(messageData);
    }

    async rollDamage() {
        const abilityName = this.system.attackAbility;
        const abilityMod = this.actor.system.attributes[abilityName].mod;
        let dmgRoll = this.system.dmg;

        if (parseInt(abilityMod) != 0) {
            dmgRoll += " + " + abilityMod;
        }

        const r = new CONFIG.Dice.DamageRoll(dmgRoll, this.actor.system);

        const configured = await r.configureDialog({
            title: `Damage from ${this.name}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        const damageType = this.system.details.type || "";
        const secDamageType = this.system.details.sec_type;

        let damageTypeText = "";
        if (damageType) {
            damageTypeText = ` <span class="damage-type-label">${damageType}`;
            if (secDamageType) {
                damageTypeText += `/${secDamageType}`;
            }
            damageTypeText += ` damage</span>`;
        }
        const rollHtml = await r.render();
        const customRollHtml = rollHtml.replace(
            /<\/h4>/,
            `${damageTypeText}</h4>`
        );

        let soundPath = null;
        if (this.system.dmgSnd) {
            const resp = await fetch(this.system.dmgSnd, { method: 'HEAD' });
            if (resp.ok) {
                soundPath = this.system.dmgSnd;
            } else {
                ui.notifications.warn("Damage sound path for " + this.name + " could not be resolved: " + this.system.dmgSnd);
            }
        }

        // Targeted tokens: the active GM client applies the damage once the message exists
        const targetUuids = game.settings.get("sgrpg", "autoApplyDamage")
            ? [...game.user.targets].map(t => t.document.uuid) : [];

        console.log(`sgrpg | damage roll, targeted tokens: ${targetUuids.length}`);
        const messageData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: [r],
            content: customRollHtml,
            flags: targetUuids.length ? {sgrpg: {damage: {total: r.total, type: damageType, targets: targetUuids}}} : {},
            flavor: `<strong>${this.name}</strong>`,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            sound: soundPath || CONFIG.sounds.dice
        };
        ChatMessage.applyRollMode(messageData, r.options.rollMode || game.settings.get("core", "rollMode"));

        return ChatMessage.create(messageData);
    }

    async consume() {
        const remainingCount = parseInt(this.system.quantity);
        if (remainingCount < 1) {
            return ui.notifications.warn("You dont have any more of these items to consume!");
        }

        await this.update({
            "system.quantity": remainingCount - 1
        });
        return ui.notifications.info(`Item '${this.name}' was consumed, ${remainingCount - 1} usages remain.`);
    }

    /**
     * Display the chat card for an item
     * @param {object} options
     * @param {string} rollMode
     * @param {boolean} createMessage
     */
    async displayCard({rollMode, createMessage=true}={}) {
        const token = this.actor.token;
        const templateData = {
            actor: this.actor,
            tokenId: token?.uuid || null,
            item: this,
            kind: {weapon: "Weapon", equip: "Equipment", origin: "Origin", classAbility: "Class ability", feat: "Feat"}[this.type] || "Item",
            hasConsume: this.type === "equip",
            data: await this.getChatData(),
            hasAttack: this.hasAttack,
        };
        const html = await renderTemplate("systems/sgrpg/templates/chat/item-card.html", templateData);

        const chatData = {
            user: game.user._id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: html,
            flavor: this.system.chatFlavor || this.name,
            speaker: ChatMessage.getSpeaker({actor: this.actor, token}),
            flags: {"core.canPopout": true},
        };

        ChatMessage.applyRollMode(chatData, rollMode || game.settings.get("core", "rollMode"));

        return createMessage ? ChatMessage.create(chatData) : chatData;
    }

    /**
     * Prepare chat data for displaying an item card
     * @param {Object} htmlOptions
     * @return {Promise<Object>}
     */
    async getChatData(htmlOptions={}) {
        const data = foundry.utils.deepClone(this.system);

        data.description = await TextEditor.enrichHTML(this.system.description?.value ?? "", htmlOptions);
        data.labels = this._getItemLabels(this);
        return data;
    }


    static chatListeners(html) {
        const element = html instanceof HTMLElement ? html : html[0];

        element.querySelectorAll('.card-buttons button').forEach(btn => {
            btn.addEventListener('click', this._onChatCardAction.bind(this));
        });

        element.querySelectorAll('.item-name').forEach(name => {
            name.addEventListener('click', this._onChatCardToggleContent.bind(this));
        });
    }

    /**
     * Toggle chat card content visibility
     * @param {Event} event
     * @private
     */
    static _onChatCardToggleContent(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const card = header.closest(".chat-card");
        const content = card.querySelector(".card-content");
        content.style.display = content.style.display === "none" ? "block" : "none";
    }

    static async _onChatCardAction(event) {
        event.preventDefault();

        const button = event.currentTarget;
        button.disabled = true;

        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message =  game.messages.get(messageId);
        const action = button.dataset.action;

        if ( !( game.user.isGM || message.isAuthor ) ) return;

        const actor = await this._getChatCardActor(card);
        if ( !actor ) return;

        const item = actor.items.get(card.dataset.itemId);
        if ( !item ) {
            return ui.notifications.error("No associated item or item no longer exists!")
        }

        switch ( action ) {
          case "attack":
            await item.rollAttack(event); break;
          case "damage":
            await item.rollDamage({
              critical: event.altKey,
              event: event,
            });
            break;
          case "consume":
              await item.consume(event);
              break
        }

        button.disabled = false;
    }

    /**
     * Get item property labels
     * @return {Array}
     * @private
     */
    _getItemLabels(item) {
        const labels = [];

        if ( item.type === "weapon" ) {
            if (item.system.ammo && item.system.ammo.target) {
                // Add reload info if item uses ammo
                if (item.system.ammo.reload) {
                    labels.push("Reload: " + item.system.ammo.reload);
                }
            }
            if (item.system.details.special?.length) {
                labels.push(item.system.details.special);
            }

            if (item.system.details.type) {
                labels.push("Damage: " + item.system.details.type);
            }
            if (item.system.details.sec_type) {
                labels.push("Sec.damage: " + item.system.details.sec_type);
            }
        }

        return labels;
    }

    /**
     * Get the actor from a chat card
     * @param {HTMLElement} card
     * @return {Actor|null}
     * @private
     */
    static async _getChatCardActor(card) {

        if ( card.dataset.tokenId ) {
            const token = await fromUuid(card.dataset.tokenId);
            if ( !token ) return null;
            return token.actor;
        }

        const actorId = card.dataset.actorId;
        return game.actors.get(actorId) || null;
    }
}