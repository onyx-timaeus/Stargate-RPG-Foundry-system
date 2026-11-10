// Namespace Configuration Values
export const SGRPG = {};


SGRPG.abilities = {
    "str": "Strength",
    "dex": "Dexterity",
    "con": "Constitution",
    "int": "Intelligence",
    "wis": "Wisdom",
    "cha": "Charisma"
  };

SGRPG.skills = {
    "acrobatics": "Acrobatics",
    "animalhandling": "Animal Handling",
    "athletics": "Athletics",
    "culture": "Culture",
    "deception": "Deception",
    "engineering": "Engineering",
    "history": "History",
    "insight": "Insight",
    "intimidation": "Intimidation",
    "investigation": "Investigation",
    "medicine": "Medicine",
    "nature": "Nature",
    "perception": "Perception",
    "performance": "Performance",
    "persuasion": "Persuasion",
    "pilot": "Pilot",
    "science": "Science",
    "sleight": "Sleight of Hand",
    "stealth": "Stealth",
    "survival": "Survival"
  };


SGRPG.attackTypes = {
    piercing: "Piercing",
    bludgeoning: "Bludgeoning",
    slashing: "Slashing",
    fire: "Fire",
    lightning: "Lightning",
    cold: "Cold",
    acid: "Acid",
    poison: "Poison",
    force: "Force",
    radiant: "Radiant",
    necrotic: "Necrotic",
    psychic: "Psychic",
    sonic: "Sonic",
    explosive: "Explosive"
};

SGRPG.sizes = {
  tiny: "Tiny",
  small: "Small",
  medium: "Medium",
  large: "Large",
  huge: "Huge",
  grg: "Gargantuan"
}

SGRPG.tensionDice = {
  "d4": "Comedic (d4)",
  "d6": "Standard (d6)",
  "d8": "Growing (d8)",
  "d10": "Dire (d10)",
  "d12": "All is Lost (d12)",
};
SGRPG.defaultTensionDie = "d6";

SGRPG.actionReloadValue = "act_based_reload";

/**
 * This Object defines the types of single or area targets which can be applied
 * @type {Object}
 */
 SGRPG.targetTypes = {
  "none": "None",
  "self": "Self",
  "creature": "Creature",
  "ally": "Ally",
  "enemy": "Enemy",
  "space": "Space",
  "radius": "Radius",
  "sphere": "Sphere",
  "cylinder": "Cylinder",
  "cone": "Cone",
  "square": "Square",
  "cube": "Cube",
  "line": "Line",
  "wall": "Wall"
};

SGRPG.originTypes = {
  "racial": "Racial",
  "biome": "Biome",
  "background": "Background"
};

SGRPG.attributeBonuses = {
  "none": "None",
  "cha": "Charisma",
  "con": "Constitution",
  "dex": "Dexterity",
  "int": "Intelligence",
  "str": "Strength",
  "wis": "Wisdom"
};

SGRPG.weaponProficiencies = {
  "none": "None",
  "commonWeapons": "Common Weapons",
  "grenades": "Grenades",
  "jaffaWeapons": "Jaffa Weapons",
  "longarms": "Longarms",
  "martialArts": "Martial Arts",
  "shotguns": "Shotguns",
  "sidearms": "Sidearms"
};

SGRPG.weaponProficienciesSingular = {
  "none": "None",
  "commonWeapons": "Common Weapon",
  "grenades": "Grenade",
  "jaffaWeapons": "Jaffa Weapon",
  "longarms": "Longarm",
  "martialArts": "Martial Arts",
  "shotguns": "Shotgun",
  "sidearms": "Sidearm"
};

SGRPG.armorProficiencies = {
  "none": "None",
  "heavy": "Heavy",
  "light": "Light"
};

SGRPG.toolProficiencies = {
  "none": "None",
  "camoKit": "Camo Kit",
  "engineeringKit": "Engineering Kit",
  "explosives": "Explosives",
  "fabricationKit": "Fabrication Kit",
  "medKit": "Med Kit",
  "outbreakKit": "Outbreak Kit",
  "researchKit": "Research Kit",
  "translator": "Translator"
};

SGRPG.classes = {
  "soldier": "Soldier",
  "engineer": "Engineer",
  "scout": "Scout",
  "diplomat": "Diplomat",
  "medic": "Medic",
  "scientist": "Scientist"
};

SGRPG.prepRatings = {
  "0": "0-Prep (No Equipment)",
  "1": "1-Prep (Base Kit)",
  "2": "2-Prep (Phoenix Gate Camp Kit)",
  "3": "3-Prep (Extended Camp Kit)",
  "4": "4-Prep (Frontline Kit)"
};

// Configure Optional Character Flags
SGRPG.characterFlags = {
  // Initiative mode moved to system.initiativeMode in actor data
};