/**
 * Comprehensive coffee processing taxonomy
 * Organized by category with parent-child relationships and aliases
 */
const COFFEE_PROCESSING_TAXONOMY = {
  "Wet Processes": {
    description: "Processes where coffee cherries are depulped and fermented/washed before drying.",
    methods: {
      "Washed": { aliases: ["Wet Process", "Fully Washed"], parent: null },
      "Semi-Washed": { aliases: ["Semi Wet"], parent: "Washed" },
      "Double Fermented": { aliases: [], parent: "Washed" },
      "Wet Hulled": { aliases: ["Giling Basah"], parent: "Washed" },
      "Nitro Washed": { aliases: [], parent: "Washed" }
    }
  },
  "Dry Processes": {
    description: "Processes where cherries are dried with fruit intact.",
    methods: {
      "Natural": { aliases: ["Dry Process", "Sun Dried Natural"], parent: null },
      "Sun Dried": { aliases: [], parent: "Natural" },
      "Tree Dried": { aliases: [], parent: "Natural" },
      "Raisin Process": { aliases: [], parent: "Natural" },
      "Monsooned": { aliases: [], parent: "Natural" }
    }
  },
  "Honey & Mucilage Retained Processes": {
    description: "Processes retaining varying levels of mucilage during drying.",
    methods: {
      "Honey": { aliases: ["Miel Process"], parent: null },
      "White Honey": { aliases: [], parent: "Honey" },
      "Yellow Honey": { aliases: [], parent: "Honey" },
      "Red Honey": { aliases: [], parent: "Honey" },
      "Black Honey": { aliases: [], parent: "Honey" },
      "Gold Honey": { aliases: [], parent: "Honey" },
      "Pink Honey": { aliases: [], parent: "Honey" },
      "Partial Honey": { aliases: [], parent: "Honey" }
    }
  },
  "Hybrid Processes": {
    description: "Processes combining washed and natural characteristics.",
    methods: {
      "Pulped Natural": { aliases: ["Semi-Dry", "Honey Pulped"], parent: null },
      "Mixed Process": { aliases: ["Hybrid Process"], parent: null }
    }
  },
  "Anaerobic & Controlled Fermentation": {
    description: "Processes involving oxygen-controlled or precision fermentation.",
    methods: {
      "Anaerobic": { aliases: ["Anaerobic Fermentation"], parent: null },
      "Carbonic Maceration": { aliases: ["CM"], parent: "Anaerobic" },
      "Lactic Fermentation": { aliases: [], parent: "Anaerobic" },
      "Acetic Fermentation": { aliases: [], parent: "Anaerobic" },
      "Yeast Inoculated": { aliases: ["Cultured Fermentation"], parent: "Anaerobic" },
      "Nitrogen Maceration": { aliases: [], parent: "Anaerobic" },
      "Vacuum Fermentation": { aliases: [], parent: "Anaerobic" },
      "Pressure Fermentation": { aliases: [], parent: "Anaerobic" },
      "Thermal Shock": { aliases: [], parent: "Anaerobic" },
      "Cold Fermentation": { aliases: [], parent: "Anaerobic" },
      "Ice Fermentation": { aliases: [], parent: "Anaerobic" }
    }
  },
  "Co-Fermented & Flavor-Infused Processes": {
    description: "Processes involving added fruits, spices, yeasts, or external flavor agents.",
    methods: {
      "Co-Fermented": { aliases: [], parent: null },
      "Fruit Maceration": { aliases: [], parent: "Co-Fermented" },
      "Spice Fermentation": { aliases: [], parent: "Co-Fermented" },
      "Barrel Aged": { aliases: [], parent: "Co-Fermented" },
      "Whisky Barrel": { aliases: [], parent: "Barrel Aged" },
      "Rum Barrel": { aliases: [], parent: "Barrel Aged" },
      "Wine Process": { aliases: [], parent: "Co-Fermented" }
    }
  },
  "Drying & Post-Processing Methods": {
    description: "Methods primarily differentiated by drying or post-processing techniques.",
    methods: {
      "Freeze Dried": { aliases: [], parent: null },
      "Shade Dried": { aliases: [], parent: null },
      "Solar Dried": { aliases: [], parent: null },
      "Slow Dried": { aliases: [], parent: null },
      "Mechanical Dried": { aliases: [], parent: null },
      "African Bed Dried": { aliases: [], parent: null }
    }
  },
  "Experimental & Emerging Processes": {
    description: "Novel and competition-level experimental methods.",
    methods: {
      "Controlled Microbial Fermentation": { aliases: [], parent: null },
      "Sequential Fermentation": { aliases: [], parent: null },
      "Multi-Stage Fermentation": { aliases: [], parent: null },
      "Enzyme Assisted Fermentation": { aliases: [], parent: null },
      "Mosto Fermentation": { aliases: [], parent: null },
      "Osmotic Dehydration": { aliases: [], parent: null },
      "Ultrasonic Fermentation": { aliases: [], parent: null },
      "Cascade Fermentation": { aliases: [], parent: null },
      "Bioinnovation Processing": { aliases: [], parent: null }
    }
  }
};

/**
 * Build flat list of all standard processes and aliases for quick lookup
 */
function buildProcessLookup() {
  const lookup = {}; // alias/old_name => standard_name
  
  for (const category in COFFEE_PROCESSING_TAXONOMY) {
    const methods = COFFEE_PROCESSING_TAXONOMY[category].methods;
    for (const methodName in methods) {
      // Method name is canonical
      lookup[methodName.toLowerCase()] = methodName;
      
      // All aliases map to canonical name
      const aliases = methods[methodName].aliases || [];
      for (const alias of aliases) {
        lookup[alias.toLowerCase()] = methodName;
      }
    }
  }
  
  return lookup;
}

const PROCESS_LOOKUP = buildProcessLookup();
const STANDARD_PROCESSES = Object.keys(PROCESS_LOOKUP).map(key => PROCESS_LOOKUP[key])
  .filter((v, i, a) => a.indexOf(v) === i) // unique
  .sort();


/**
 * Normalize process string to standard format
 * @param {string} process - Raw process string
 * @returns {string|null} - Normalized process or null if invalid
 */
function normalizeProcess(process) {
  if (!process || typeof process !== "string") {
    return null;
  }

  const trimmed = process.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  // Look up in process lookup table (handles aliases)
  return PROCESS_LOOKUP[trimmed] || null;
}

/**
 * Get all standard processes
 * @returns {array} - Array of standard process names
 */
function getStandardProcesses() {
  return [...STANDARD_PROCESSES];
}

/**
 * Get full taxonomy structure
 * @returns {object}
 */
function getTaxonomy() {
  return JSON.parse(JSON.stringify(COFFEE_PROCESSING_TAXONOMY));
}

/**
 * Get category and details for a process
 * @param {string} process - Process name
 * @returns {object|null} - { category, description, name, aliases, parent }
 */
function getProcessDetails(process) {
  if (!process) return null;
  
  const normalized = normalizeProcess(process);
  if (!normalized) return null;

  for (const category in COFFEE_PROCESSING_TAXONOMY) {
    const methods = COFFEE_PROCESSING_TAXONOMY[category].methods;
    if (normalized in methods) {
      const method = methods[normalized];
      return {
        name: normalized,
        category,
        description: COFFEE_PROCESSING_TAXONOMY[category].description,
        aliases: method.aliases,
        parent: method.parent
      };
    }
  }

  return null;
}

/**
 * Get all processes in a category
 * @param {string} category - Category name
 * @returns {array} - Process names in category
 */
function getProcessesByCategory(category) {
  if (!COFFEE_PROCESSING_TAXONOMY[category]) {
    return [];
  }
  return Object.keys(COFFEE_PROCESSING_TAXONOMY[category].methods);
}

/**
 * Get parent process if it exists
 * @param {string} process - Process name
 * @returns {string|null}
 */
function getParentProcess(process) {
  const details = getProcessDetails(process);
  return details?.parent || null;
}

/**
 * Get all child processes
 * @param {string} process - Parent process name
 * @returns {array}
 */
function getChildProcesses(process) {
  if (!process) return [];
  
  const normalized = normalizeProcess(process);
  if (!normalized) return [];

  const children = [];
  for (const category in COFFEE_PROCESSING_TAXONOMY) {
    const methods = COFFEE_PROCESSING_TAXONOMY[category].methods;
    for (const methodName in methods) {
      if (methods[methodName].parent === normalized) {
        children.push(methodName);
      }
    }
  }

  return children;
}

/**
 * Get process hierarchy chain (from child to root parent)
 * @param {string} process - Process name
 * @returns {array} - [child, parent, grandparent, ...]
 */
function getProcessHierarchy(process) {
  const normalized = normalizeProcess(process);
  if (!normalized) return [];

  const chain = [normalized];
  let current = normalized;

  while (true) {
    const parent = getParentProcess(current);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }

  return chain;
}

/**
 * Check if a process is valid/standard
 * @param {string} process - Process to validate
 * @returns {boolean}
 */
function isValidProcess(process) {
  return normalizeProcess(process) !== null;
}

/**
 * Normalize a list of processes
 * @param {array} processes - Array of process strings
 * @returns {array} - Array of normalized processes (nulls removed)
 */
function normalizeProcessList(processes) {
  if (!Array.isArray(processes)) {
    return [];
  }

  return processes
    .map(p => normalizeProcess(p))
    .filter(p => p !== null);
}

module.exports = {
  COFFEE_PROCESSING_TAXONOMY,
  STANDARD_PROCESSES,
  PROCESS_LOOKUP,
  normalizeProcess,
  getStandardProcesses,
  getTaxonomy,
  getProcessDetails,
  getProcessesByCategory,
  getParentProcess,
  getChildProcesses,
  getProcessHierarchy,
  isValidProcess,
  normalizeProcessList
};
