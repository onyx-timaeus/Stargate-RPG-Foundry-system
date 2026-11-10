/**
 * Item selector application for adding items to inventory
 * @extends {Application}
 */
export default class InventorySelector extends Application {
  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
    this.currentTab = 'equipment';
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "inventory-selector",
      classes: ["sgrpg", "inventory-selector"],
      template: "systems/sgrpg/templates/apps/inventory-selector.hbs",
      width: 700,
      height: 650,
      resizable: true,
      title: "Add Item to Inventory"
    });
  }

  /** @override */
  async getData() {
    const data = await super.getData();

    const weapons = game.items.filter(i => i.type === 'weapon');
    weapons.sort((a, b) => a.name.localeCompare(b.name));

    const equipment = game.items.filter(i => i.type === 'equip');
    equipment.sort((a, b) => a.name.localeCompare(b.name));

    data.weapons = weapons;
    data.equipment = equipment;
    data.actor = this.actor;

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find('.inventory-tab').click(this._onTabSwitch.bind(this));
    html.find('.item-card').click(this._onItemSelect.bind(this));
    html.find('#inventory-search').on('input', this._onSearch.bind(this));
  }

  /**
   * Handle tab switching
   * @param {Event} event
   * @private
   */
  _onTabSwitch(event) {
    event.preventDefault();

    const tab = event.currentTarget.dataset.tab;
    this.currentTab = tab;

    this.element.find('.inventory-tab').removeClass('active');
    $(event.currentTarget).addClass('active');

    this.element.find('.tab-content').removeClass('active');
    this.element.find(`[data-tab-content="${tab}"]`).addClass('active');

    const searchInput = this.element.find('#inventory-search');
    searchInput.val('');
    this._onSearch({ target: searchInput[0] });
  }

  /**
   * Handle item selection
   * @param {Event} event
   * @private
   */
  async _onItemSelect(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const itemType = event.currentTarget.dataset.itemType;
    const item = game.items.get(itemId);

    if (!item) {
      ui.notifications.error("Item not found!");
      return;
    }

    let itemData = item.toObject();

    if (itemType === 'weapon') {
      itemData.type = 'equip';
      itemData.system = {
        bulk: itemData.system?.bulk || 1,
        quantity: 1,
        techLevel: itemData.system?.techLevel || 0,
        description: itemData.system?.description || '',
        lore: itemData.system?.lore || {
          origin: '',
          type: 'Weapon',
          restriction: ''
        }
      };
    }

    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    ui.notifications.info(`Added ${item.name} to inventory`);
    this.close();
  }

  /**
   * Handle search input
   * @param {Event} event
   * @private
   */
  _onSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const activeTabContent = this.element.find('.tab-content.active');
    const itemCards = activeTabContent.find('.item-card');

    itemCards.each(function() {
      const itemName = $(this).find('.item-name').text().toLowerCase();
      if (itemName.includes(searchTerm)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }
}
