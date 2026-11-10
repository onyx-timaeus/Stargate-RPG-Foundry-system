/**
 * Highlight critical hits and fumbles on d20 rolls
 */
 export const highlightCriticalSuccessFailure = function(message, html, data) {
    if ( !message.isRoll || !message.isContentVisible ) return;

    const roll = message.rolls?.[0];
    if ( !roll || !roll.dice?.length ) return;
    const d = roll.dice[0];

    const isD20 = (d.faces === 20) && ( d.values.length === 1 );
    if ( !isD20 ) return;
    const isModifiedRoll = ("success" in d.results[0]) || d.options.marginSuccess || d.options.marginFailure;
    if ( isModifiedRoll ) return;

    const critical = d.options.critical || 20;
    const fumble = d.options.fumble || 1;

    const element = html instanceof HTMLElement ? html : html[0];
    const diceTotal = element.querySelector(".dice-total");

    if (!diceTotal) return;

    if ( d.total >= critical ) diceTotal.classList.add("critical");
    else if ( d.total <= fumble ) diceTotal.classList.add("fumble");
    else if ( d.options.target ) {
      if ( roll.total >= d.options.target ) diceTotal.classList.add("success");
      else diceTotal.classList.add("failure");
    }
  };


/**
 * Give item cards ("send to chat") the same graphite look as the roll cards.
 */
export const buildItemCard = function(message, html) {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if ( !el || !message.isContentVisible ) return;
    if ( !el.querySelector(".message-content .item-card") ) return;
    el.classList.add("sg-roll-msg", "sg-item-msg");
};

/**
 * Show the speaking actor's portrait to the left of the sender name on system cards.
 */
export const addPortrait = function(message, html) {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if ( !el?.classList.contains("sg-roll-msg") ) return;
    const header = el.querySelector(".message-header");
    if ( !header || header.querySelector(".sg-portrait") ) return;
    const img = ChatMessage.getSpeakerActor(message.speaker)?.img;
    if ( !img ) return;
    const portrait = document.createElement("img");
    portrait.className = "sg-portrait";
    portrait.src = img;
    portrait.alt = "";
    header.prepend(portrait);
};

/**
 * Restyle roll messages into the system card: kind label, title, big total.
 * Works on top of Foundry's own roll markup so click-to-expand still works.
 * Natural 20 / natural 1 on the d20 add a gold / muted red accent.
 */
export const buildRollCard = function(message, html) {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if ( !el || !message.isRoll || !message.isContentVisible ) return;
    const roll = message.rolls?.[0];
    const dr = el.querySelector(".message-content .dice-roll");
    if ( !roll || !dr || dr.querySelector(".sg-head") ) return;

    const flavorEl = el.querySelector(".message-header .flavor-text");
    let title = (flavorEl?.textContent || "").trim();
    const attack = !!el.querySelector(".attack-card");
    const tags = [];

    const adv = title.match(/\((Advantage|Disadvantage)\)/i);
    if ( adv ) tags.push(adv[1].toLowerCase());
    if ( /\(CriticalHit\)/i.test(title) ) tags.push("critical hit");
    title = title.replace(/\s*\((Advantage|Disadvantage|CriticalHit)\)/gi, "").trim();

    const d0 = roll.dice?.[0];
    const isD20 = d0?.faces === 20;
    let kind = "Roll";
    if ( attack ) kind = "Attack";
    else if ( roll instanceof CONFIG.Dice.DamageRoll ) kind = "Damage";
    else if ( isD20 ) kind = /saving/i.test(title) ? "Saving throw" : "Skill check";
    if ( kind === "Saving throw" ) title = title.replace(/\s*Saving Throw$/i, "");

    // Initiative: just "Initiative" (no "Skill check", no actor name, no sentence)
    if ( message.flags?.core?.initiativeRoll || /initiative/i.test(title) ) { kind = "Initiative"; title = ""; el.classList.add("sg-initiative"); }

    const typeLabel = dr.querySelector(".damage-type-label")?.textContent.replace(/\s*damage$/i, "").trim();
    if ( typeLabel ) tags.unshift(typeLabel);

    if ( isD20 && d0.results.length >= 1 ) {
        const kept = d0.results.filter(r => r.active !== false);
        const nat = kept.length === 1 ? kept[0].result : d0.total;
        const crit = d0.options?.critical || 20;
        const fumble = d0.options?.fumble || 1;
        if ( nat >= crit ) { el.classList.add("sg-nat20"); tags.push(`natural ${nat}`); }
        else if ( nat <= fumble ) { el.classList.add("sg-nat1"); tags.push(`natural ${nat}`); }
    }

    const head = document.createElement("div");
    head.className = "sg-head";
    const titles = document.createElement("div"); titles.className = "sg-titles";
    const k = document.createElement("div"); k.className = "sg-kind";
    const isDamage = roll instanceof CONFIG.Dice.DamageRoll;
    if ( isDamage ) el.classList.add("sg-damage");
    // Attack cards show no "Attack" label; damage cards show only the damage type
    k.textContent = (attack || isDamage ? tags : [kind, ...tags]).filter(Boolean).join(" · ");
    if ( !k.textContent ) k.hidden = true;
    const t = document.createElement("div"); t.className = "sg-title"; t.textContent = attack ? "" : title;
    // Damage cards: weapon name first, damage type underneath (coloured per type)
    if ( isDamage && typeLabel ) k.dataset.dmg = typeLabel.toLowerCase().replace(/[^a-z]/g, "");
    if ( isDamage ) titles.append(t, k); else titles.append(k, t);
    const stamp = document.createElement("div"); stamp.className = "sg-stamp";
    const b = document.createElement("b"); b.textContent = roll.total;
    const i = document.createElement("i"); i.textContent = isDamage ? "DAMAGE" : "TOTAL";
    stamp.append(b, i);
    head.append(titles, stamp);
    dr.prepend(head);

    // Damage that was applied automatically to targeted tokens
    const applied = message.flags?.sgrpg?.applied;
    if ( applied?.length ) {
        const line = document.createElement("div");
        line.className = "sg-applied";
        line.textContent = applied.map(x => `${x.name}: −${x.amount} HP${x.state !== "normal" ? ` (${x.state})` : ""}`).join(" · ");
        dr.closest(".message-content")?.append(line);
    }

    // Hovering a die shows its type (D20, D8, ...)
    const diceTerms = roll.terms.filter(t => t instanceof foundry.dice.terms.DiceTerm);
    dr.querySelectorAll(".dice-tooltip .tooltip-part").forEach((part, idx) => {
        const term = diceTerms[idx];
        if ( !term ) return;
        part.querySelectorAll(".dice-rolls .roll").forEach(d => d.setAttribute("data-tooltip", `D${term.faces}`));
    });

    // Calculation breakdown lives in the expandable section (click the card)
    const tip = dr.querySelector(".dice-tooltip");
    if ( tip && !tip.querySelector(".sg-calc") ) {
        const calc = document.createElement("div"); calc.className = "sg-calc";
        const row = (label, value, cls="") => {
            const r = document.createElement("div"); r.className = `sg-calc-row ${cls}`.trim();
            const l = document.createElement("span"); l.textContent = label;
            const v = document.createElement("b"); v.textContent = value;
            r.append(l, v); calc.append(r);
        };
        let sign = 1;
        for ( const term of roll.terms ) {
            if ( term instanceof foundry.dice.terms.OperatorTerm ) { sign = term.operator === "-" ? -1 : 1; continue; }
            const sg = sign < 0 ? "−" : "+";
            if ( term instanceof foundry.dice.terms.DiceTerm ) {
                sign = 1; continue; // dice are already shown by Foundry's own breakdown above
            } else if ( term instanceof foundry.dice.terms.NumericTerm ) {
                row("Modifier", `${sg} ${term.number}`);
            } else {
                row(term.expression, `${sg} ${term.total}`);
            }
            sign = 1;
        }
        // Only add the breakdown when there is a modifier to show (the dice are listed above already)
        if ( calc.children.length ) {
            row("Total", String(roll.total), "sg-calc-total");
            tip.append(calc);
        }
    }
    dr.classList.add("sg-built");
    el.classList.add("sg-roll-msg");
    if ( attack ) el.classList.add("sg-attack");
};

  /**
 * Add context menu options to chat messages for applying damage
 *
 * @param {HTMLElement} html
 * @param {Array} options
 *
 * @return {Array}
 */
export const addChatMessageContextOptions = function(html, options) {
  let canApply = li => {
    const messageId = li.dataset?.messageId || li.getAttribute?.("data-message-id");
    const message = game.messages.get(messageId);
    return message?.isRoll && message?.isContentVisible && canvas.tokens?.controlled.length;
  };
  options.push(
    {
      name: "Apply damage",
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    },
    {
      name: "Apply healing",
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, -1)
    },
    {
      name: "Apply double damage",
      icon: '<i class="fas fa-user-injured"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 2)
    },
    {
      name: "Apply half damage",
      icon: '<i class="fas fa-user-shield"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 0.5)
    }
  );
  return options;
};

/**
 * Apply damage from chat roll to controlled tokens
 *
 * @param {HTMLElement} li
 * @param {Number} multiplier
 * @return {Promise}
 */
function applyChatCardDamage(li, multiplier) {
  const messageId = li.dataset?.messageId || li.getAttribute?.("data-message-id");
  const message = game.messages.get(messageId);
  const roll = message.roll;
  return Promise.all(canvas.tokens.controlled.map(t => {
    const a = t.actor;
    return a.applyDamage(roll.total, multiplier);
  }));
}