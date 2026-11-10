



export default class D20Roll extends Roll {
    constructor(formula, data, options) {
        super(formula, data, options);
        if ( !((this.terms[0] instanceof Die) && (this.terms[0].faces === 20)) ) {
          throw new Error(`Invalid D20Roll formula provided ${this._formula}`);
        }
      }


    /**
     * Advantage mode for d20 rolls
     * @enum {number}
     */
    static ADV_MODE = {
        NORMAL: 0,
        ADVANTAGE: 1,
        DISADVANTAGE: -1,
    }

    static EVALUATION_TEMPLATE = "systems/sgrpg/templates/chat/roll-dialog.html";

    /**
     * Check if roll has advantage
     * @type {boolean}
     */
    get hasAdvantage() {
        return this.options.advantageMode === D20Roll.ADV_MODE.ADVANTAGE;
    }

    /**
     * Check if roll has disadvantage
     * @type {boolean}
     */
    get hasDisadvantage() {
        return this.options.advantageMode === D20Roll.ADV_MODE.DISADVANTAGE;
    }

    /** @inheritdoc */
    async toMessage(messageData={}, options={}) {

        if ( !this._evaluated ) await this.evaluate();

        messageData.flavor = messageData.flavor || this.options.flavor;
        if ( this.hasAdvantage ) messageData.flavor += " (Advantage)";
        else if ( this.hasDisadvantage ) messageData.flavor += " (Disadvantage)";

        options.rollMode = options.rollMode ?? this.options.rollMode;
        return super.toMessage(messageData, options);
    }


    /**
     * Show dialog to configure roll options
     * @param {object} data
     * @param {string} [data.title]
     * @param {number} [data.defaultRollMode]
     * @param {number} [data.defaultAction]
     * @param {boolean} [data.chooseModifier]
     * @param {string} [data.defaultAbility]
     * @param {string} [data.template]
     * @param {object} options
     * @returns {Promise<D20Roll|null>}
     */
    async configureDialog({title, defaultRollMode, defaultAction=D20Roll.ADV_MODE.NORMAL, chooseModifier=false, defaultAbility}={}, options={}) {

        const content = await renderTemplate(this.constructor.EVALUATION_TEMPLATE, {
            formula: `${this.formula} + @bonus`,
            defaultRollMode,
            rollModes: CONFIG.Dice.rollModes,
            chooseModifier,
            defaultAbility,
            abilities: CONFIG.SGRPG.abilities
        });

        let defaultButton = "normal";
        switch (defaultAction) {
            case D20Roll.ADV_MODE.ADVANTAGE: defaultButton = "advantage"; break;
            case D20Roll.ADV_MODE.DISADVANTAGE: defaultButton = "disadvantage"; break;
        }

        return new Promise(resolve => {
                new Dialog({
                    title,
                    content,
                    buttons: {
                    advantage: {
                        label: "Advantage",
                        callback: html => resolve(this._onDialogSubmit(html, D20Roll.ADV_MODE.ADVANTAGE))
                    },
                    normal: {
                        label: "Normal",
                        callback: html => resolve(this._onDialogSubmit(html, D20Roll.ADV_MODE.NORMAL))
                    },
                    disadvantage: {
                        label: "Disadvantage",
                        callback: html => resolve(this._onDialogSubmit(html, D20Roll.ADV_MODE.DISADVANTAGE))
                    }
                    },
                    default: defaultButton,
                    close: () => resolve(null)
                }, options).render(true);
        });
    }


    /**
     * Handle dialog submission
     * @param {jQuery} html
     * @param {number} advantageMode
     * @private
     */
    _onDialogSubmit(html, advantageMode) {
        const form = html[0].querySelector("form");

        if ( form.bonus.value ) {
        const bonus = new Roll(form.bonus.value, this.data);
        if ( !(bonus.terms[0] instanceof OperatorTerm) ) this.terms.push(new OperatorTerm({operator: "+"}));
            this.terms = this.terms.concat(bonus.terms);
        }

        if ( form.ability?.value ) {
            const abl = this.data.abilities[form.ability.value];
            this.terms.findSplice(t => t.term === "@mod", new NumericTerm({number: abl.mod}));
            this.options.flavor += ` (${CONFIG.SGRPG.abilities[form.ability.value]})`;
        }

        this.options.advantageMode = advantageMode;
        this.options.rollMode = form.rollMode.value;
        this.configureModifiers();
        return this;
    }


    /**
     * Apply advantage/disadvantage modifiers
     * @private
     */
    configureModifiers() {
        const d20 = this.terms[0];
        d20.modifiers = [];

        if ( this.hasAdvantage ) {
            d20.number = 2;
            d20.modifiers.push("kh");
            d20.options.advantage = true;
        }
        else if ( this.hasDisadvantage ) {
            d20.number = 2;
            d20.modifiers.push("kl");
            d20.options.disadvantage = true;
        }
        else {
            d20.number = 1;
        }

        if ( this.options.critical ) d20.options.critical = this.options.critical;
        if ( this.options.fumble ) d20.options.fumble = this.options.fumble;
        if ( this.options.targetValue ) d20.options.target = this.options.targetValue;

        this._formula = this.constructor.getFormula(this.terms);
    }
}