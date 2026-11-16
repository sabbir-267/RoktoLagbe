const DAY = 24 * 60 * 60 * 1000;

// Typical shelf life in days; confirm against local blood bank policy
export const SHELF_LIFE_DAYS = { whole_blood: 35, red_cells: 42, platelets: 5, plasma: 365 };
export const COMPONENTS = Object.keys(SHELF_LIFE_DAYS);

export const defaultExpiry = (collectedAt, component) =>
  new Date(new Date(collectedAt).getTime() + SHELF_LIFE_DAYS[component] * DAY);