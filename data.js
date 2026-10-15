// game data exported to global
const GAME_DATA = (function(){
  const rarities = [
    { key: "basic", label: "Basic", rank:1, hex: "#FFFFFF" },
    { key: "common", label: "Common", rank:2, hex: "#9E9E9E" },
    { key: "uncommon", label: "Uncommon", rank:3, hex: "#4CAF50" },
    { key: "rare", label: "Rare", rank:4, hex: "#1565C0" },
    { key: "epic", label: "Epic", rank:5, hex: "#9C27B0" },
    { key: "legendary", label: "Legendary", rank:6, hex: "#FFC107" },
    { key: "mythic", label: "Mythic", rank:7, hex: "#D32F2F" },
    { key: "exotic", label: "Exotic", rank:8, hex: "#00BCD4" },
    { key: "godly", label: "Godly", rank:9, hex: "#FFD700" },
    { key: "ethereal", label: "Ethereal", rank:10, hex: "#BFC9CA" }
  ];

  const packs = [
    { key: "starter", label:"Starter Pack", price:100, cardsPerPack:3, rarityWeights:{ basic:50, common:30, uncommon:15, rare:5 }, imagePath:"" },
    { key: "fortified", label:"Fortified Pack", price:250, cardsPerPack:3, rarityWeights:{ common:35, uncommon:30, rare:20, epic:10, legendary:5 }, imagePath:"" },
    { key: "standard", label:"Standard Pack", price:500, cardsPerPack:4, rarityWeights:{ common:30, uncommon:25, rare:22, epic:15, legendary:8 }, imagePath:"" },
    { key: "advanced", label:"Advanced Pack", price:900, cardsPerPack:5, rarityWeights:{ common:20, uncommon:20, rare:25, epic:20, legendary:10, mythic:5 }, imagePath:"" },
    { key: "premium", label:"Premium Pack", price:1800, cardsPerPack:5, rarityWeights:{ uncommon:10, rare:20, epic:25, legendary:20, mythic:15, exotic:8, godly:2 }, imagePath:"" },
    { key: "divine", label:"Divine Pack", price:4000, cardsPerPack:6, rarityWeights:{ rare:10, epic:20, legendary:25, mythic:20, exotic:15, godly:7, ethereal:3 }, imagePath:"" }
  ];

  const library = [
    { id:"basic_1", name:"Pebble Guard", rarity:"basic" },
    { id:"common_1", name:"Wooden Spear", rarity:"common" },
    { id:"uncommon_1", name:"Emerald Dagger", rarity:"uncommon" },
    { id:"rare_1", name:"Azure Shield", rarity:"rare" },
    { id:"epic_1", name:"Violet Tome", rarity:"epic" },
    { id:"legendary_1", name:"Sunblade", rarity:"legendary" },
    { id:"mythic_1", name:"Crimson Empress", rarity:"mythic" },
    { id:"exotic_1", name:"Aqua Relic", rarity:"exotic" },
    { id:"godly_1", name:"Crown of Dawn", rarity:"godly" },
    { id:"ethereal_1", name:"Starlit Wisp", rarity:"ethereal" }
  ];

  return { rarities, packs, library };
})();
