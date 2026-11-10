export default class SGOriginSheet extends ItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          classes: ["sheet", "item", "itemsheet", "origin-sheet", "sgrpg"],
          width: 520,
          height: 600,
          tabs: []  // No tabs for origin sheet
        });
    }

    get template() {
        return `systems/sgrpg/templates/sheets/origin-sheet.hbs`;
    }

    getData(options) {
        let isOwner = this.item.isOwner;
        const data = {
          owner: isOwner,
          limited: this.item.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          rollData: this.item.getRollData.bind(this.item),
          config: CONFIG.SGRPG
        };

        // The Item's data
        const itemData = this.item.toObject(false);
        data.item = itemData;
        data.system = itemData.system;
        data.data = itemData.system;  // Keep for template compatibility

        return data;
    }

    /** @override */
    async _render(force, options) {
        // Store scroll position before render
        const scrollPos = this.element?.find('.sheet-body')?.scrollTop() || 0;

        await super._render(force, options);

        // Restore scroll position after render
        if (scrollPos > 0) {
            this.element.find('.sheet-body').scrollTop(scrollPos);
        }
    }

    /** @override */
    async activateEditor(name, options={}, initialContent="") {
        options.content_style = "body { color: #e0e0e0; background-color: rgba(5, 15, 25, 0.9); } body * { color: #e0e0e0; }";
        return super.activateEditor(name, options, initialContent);
    }
}
