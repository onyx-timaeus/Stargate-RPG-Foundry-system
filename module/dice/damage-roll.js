/**
 * Damage or healing roll
 * @param {string} formula
 * @param {object} data
 * @param {object} [options={}]
 * @param {number} [options.criticalBonusDice=0]
 * @param {number} [options.criticalMultiplier=2]
 * @param {boolean} [options.multiplyNumeric=false]
 * @param {boolean} [options.powerfulCritical=false]
 */
export default class DamageRoll extends Roll {
  constructor(formula, data, options) {
    super(formula, data, options);
    if ( this.options.critical !== undefined ) this.configureDamage();
  }

  static EVALUATION_TEMPLATE = "systems/sgrpg/templates/chat/roll-dialog.html";

  /**
   * Check if roll is a critical hit
   * @type {boolean}
   */
  get isCritical() {
    return this.options.critical;
  }

  /**
   * Apply critical hit modifiers
   * @private
   */
  configureDamage() {
    let flatBonus = 0;
    for ( let [i, term] of this.terms.entries() ) {

      if ( term instanceof DiceTerm ) {
        term.options.baseNumber = term.options.baseNumber ?? term.number; // Reset back
        term.number = term.options.baseNumber;
        if ( this.isCritical ) {
          let cm = this.options.criticalMultiplier ?? 2;

          if ( this.options.powerfulCritical ) {
            flatBonus += (term.number * term.faces);
            cm = Math.max(1, cm-1);
          }

          let cb = (this.options.criticalBonusDice && (i === 0)) ? this.options.criticalBonusDice : 0;
          term.alter(cm, cb);
          term.options.critical = true;
        }

      }

      else if ( this.options.multiplyNumeric && (term instanceof NumericTerm)  ) {
        term.options.baseNumber = term.options.baseNumber ?? term.number; // Reset back
        term.number = term.options.baseNumber;
        if ( this.isCritical ) {
          term.number *= (this.options.criticalMultiplier ?? 2);
          term.options.critical = true;
        }
      }
    }

    if ( this.options.powerfulCritical && (flatBonus > 0) ) {
      this.terms.push(new OperatorTerm({operator: "+"}));
      this.terms.push(new NumericTerm({number: flatBonus}, {flavor: "PowerfulCritical"}));
    }

    this._formula = this.constructor.getFormula(this.terms);
  }

  /** @inheritdoc */
  toMessage(messageData={}, options={}) {
    messageData.flavor = messageData.flavor || this.options.flavor;
    if ( this.isCritical ) {
      const label = "CriticalHit";
      messageData.flavor = messageData.flavor ? `${messageData.flavor} (${label})` : label;
    }
    options.rollMode = options.rollMode ?? this.options.rollMode;
    return super.toMessage(messageData, options);
  }

  /**
   * Show dialog to configure roll options
   * @param {object} data
   * @param {string} [data.title]
   * @param {number} [data.defaultRollMode]
   * @param {string} [data.defaultCritical]
   * @param {string} [data.template]
   * @param {boolean} [data.allowCritical=true]
   * @param {object} options
   * @returns {Promise<D20Roll|null>}
   */
  async configureDialog({title, defaultRollMode, defaultCritical=false, template, allowCritical=true}={}, options={}) {

    const content = await renderTemplate(template ?? this.constructor.EVALUATION_TEMPLATE, {
      formula: `${this.formula} + @bonus`,
      defaultRollMode,
      rollModes: CONFIG.Dice.rollModes,
    });

    return new Promise(resolve => {
      new Dialog({
        title,
        content,
        buttons: {
          critical: {
            condition: allowCritical,
            label: "CriticalHit",
            callback: html => resolve(this._onDialogSubmit(html, true))
          },
          normal: {
            label: allowCritical ? "Normal" : "Roll",
            callback: html => resolve(this._onDialogSubmit(html, false))
          }
        },
        default: defaultCritical ? "critical" : "normal",
        close: () => resolve(null)
      }, options).render(true);
    });
  }

  /**
   * Handle dialog submission
   * @param {jQuery} html
   * @param {boolean} isCritical
   * @private
   */
  _onDialogSubmit(html, isCritical) {
    const form = html[0].querySelector("form");

    if ( form.bonus.value ) {
      const bonus = new Roll(form.bonus.value, this.data);
      if ( !(bonus.terms[0] instanceof OperatorTerm) ) this.terms.push(new OperatorTerm({operator: "+"}));
      this.terms = this.terms.concat(bonus.terms);
    }

    this.options.critical = isCritical;
    this.options.rollMode = form.rollMode.value;
    this.configureDamage();
    return this;
  }

  /** @inheritdoc */
  static fromData(data) {
    const roll = super.fromData(data);
    roll._formula = this.getFormula(roll.terms);
    return roll;
  }
}
