/**
 * Weapon selector application for adding weapons to inventory
 * @extends {Application}
 */
export default class WeaponSelector extends Application {
  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "weapon-selector",
      classes: ["sgrpg", "weapon-selector"],
      template: "systems/sgrpg/templates/apps/weapon-selector.hbs",
      width: 600,
      height: 600,
      resizable: true,
      title: "Select Weapon"
    });
  }

  /** @override */
  async getData() {
    const data = await super.getData();

    const weapons = game.items.filter(i => i.type === 'weapon');
    weapons.sort((a, b) => a.name.localeCompare(b.name));

    data.weapons = weapons;
    data.actor = this.actor;
    data.config = CONFIG.SGRPG;

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find('.weapon-card').click(this._onWeaponSelect.bind(this));
    html.find('#weapon-search').on('input', this._onSearch.bind(this));
  }

  /**
   * Handle weapon selection
   * @param {Event} event
   * @private
   */
  async _onWeaponSelect(event) {
    event.preventDefault();

    const weaponId = event.currentTarget.dataset.weaponId;
    const weapon = game.items.get(weaponId);

    if (!weapon) {
      ui.notifications.error("Weapon not found!");
      return;
    }

    await this.actor.createEmbeddedDocuments("Item", [weapon.toObject()]);

    ui.notifications.info(`Added ${weapon.name} to inventory`);
    this.close();
  }

  /**
   * Handle search input
   * @param {Event} event
   * @private
   */
  _onSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const weaponCards = this.element.find('.weapon-card');

    weaponCards.each(function() {
      const weaponName = $(this).find('.weapon-name').text().toLowerCase();
      if (weaponName.includes(searchTerm)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }
}
