export interface ChemicalElement {
  atomicNumber: number;
  symbol: string;
  name: string;
  row: number;
  col: number;
}

/**
 * Standard periodic table layout:
 * Rows 1-7: Main table (18 columns)
 * Row 8: Lanthanides (Ce-Lu, cols 4-17)
 * Row 9: Actinides (Th-Lr, cols 4-17)
 * La at (6,3), Ac at (7,3) in the main table.
 */
export const PERIODIC_TABLE_ELEMENTS: ChemicalElement[] = [
  // Row 1
  { atomicNumber: 1, symbol: "H", name: "Hydrogen", row: 1, col: 1 },
  { atomicNumber: 2, symbol: "He", name: "Helium", row: 1, col: 18 },
  // Row 2
  { atomicNumber: 3, symbol: "Li", name: "Lithium", row: 2, col: 1 },
  { atomicNumber: 4, symbol: "Be", name: "Beryllium", row: 2, col: 2 },
  { atomicNumber: 5, symbol: "B", name: "Boron", row: 2, col: 13 },
  { atomicNumber: 6, symbol: "C", name: "Carbon", row: 2, col: 14 },
  { atomicNumber: 7, symbol: "N", name: "Nitrogen", row: 2, col: 15 },
  { atomicNumber: 8, symbol: "O", name: "Oxygen", row: 2, col: 16 },
  { atomicNumber: 9, symbol: "F", name: "Fluorine", row: 2, col: 17 },
  { atomicNumber: 10, symbol: "Ne", name: "Neon", row: 2, col: 18 },
  // Row 3
  { atomicNumber: 11, symbol: "Na", name: "Sodium", row: 3, col: 1 },
  { atomicNumber: 12, symbol: "Mg", name: "Magnesium", row: 3, col: 2 },
  { atomicNumber: 13, symbol: "Al", name: "Aluminium", row: 3, col: 13 },
  { atomicNumber: 14, symbol: "Si", name: "Silicon", row: 3, col: 14 },
  { atomicNumber: 15, symbol: "P", name: "Phosphorus", row: 3, col: 15 },
  { atomicNumber: 16, symbol: "S", name: "Sulfur", row: 3, col: 16 },
  { atomicNumber: 17, symbol: "Cl", name: "Chlorine", row: 3, col: 17 },
  { atomicNumber: 18, symbol: "Ar", name: "Argon", row: 3, col: 18 },
  // Row 4
  { atomicNumber: 19, symbol: "K", name: "Potassium", row: 4, col: 1 },
  { atomicNumber: 20, symbol: "Ca", name: "Calcium", row: 4, col: 2 },
  { atomicNumber: 21, symbol: "Sc", name: "Scandium", row: 4, col: 3 },
  { atomicNumber: 22, symbol: "Ti", name: "Titanium", row: 4, col: 4 },
  { atomicNumber: 23, symbol: "V", name: "Vanadium", row: 4, col: 5 },
  { atomicNumber: 24, symbol: "Cr", name: "Chromium", row: 4, col: 6 },
  { atomicNumber: 25, symbol: "Mn", name: "Manganese", row: 4, col: 7 },
  { atomicNumber: 26, symbol: "Fe", name: "Iron", row: 4, col: 8 },
  { atomicNumber: 27, symbol: "Co", name: "Cobalt", row: 4, col: 9 },
  { atomicNumber: 28, symbol: "Ni", name: "Nickel", row: 4, col: 10 },
  { atomicNumber: 29, symbol: "Cu", name: "Copper", row: 4, col: 11 },
  { atomicNumber: 30, symbol: "Zn", name: "Zinc", row: 4, col: 12 },
  { atomicNumber: 31, symbol: "Ga", name: "Gallium", row: 4, col: 13 },
  { atomicNumber: 32, symbol: "Ge", name: "Germanium", row: 4, col: 14 },
  { atomicNumber: 33, symbol: "As", name: "Arsenic", row: 4, col: 15 },
  { atomicNumber: 34, symbol: "Se", name: "Selenium", row: 4, col: 16 },
  { atomicNumber: 35, symbol: "Br", name: "Bromine", row: 4, col: 17 },
  { atomicNumber: 36, symbol: "Kr", name: "Krypton", row: 4, col: 18 },
  // Row 5
  { atomicNumber: 37, symbol: "Rb", name: "Rubidium", row: 5, col: 1 },
  { atomicNumber: 38, symbol: "Sr", name: "Strontium", row: 5, col: 2 },
  { atomicNumber: 39, symbol: "Y", name: "Yttrium", row: 5, col: 3 },
  { atomicNumber: 40, symbol: "Zr", name: "Zirconium", row: 5, col: 4 },
  { atomicNumber: 41, symbol: "Nb", name: "Niobium", row: 5, col: 5 },
  { atomicNumber: 42, symbol: "Mo", name: "Molybdenum", row: 5, col: 6 },
  { atomicNumber: 43, symbol: "Tc", name: "Technetium", row: 5, col: 7 },
  { atomicNumber: 44, symbol: "Ru", name: "Ruthenium", row: 5, col: 8 },
  { atomicNumber: 45, symbol: "Rh", name: "Rhodium", row: 5, col: 9 },
  { atomicNumber: 46, symbol: "Pd", name: "Palladium", row: 5, col: 10 },
  { atomicNumber: 47, symbol: "Ag", name: "Silver", row: 5, col: 11 },
  { atomicNumber: 48, symbol: "Cd", name: "Cadmium", row: 5, col: 12 },
  { atomicNumber: 49, symbol: "In", name: "Indium", row: 5, col: 13 },
  { atomicNumber: 50, symbol: "Sn", name: "Tin", row: 5, col: 14 },
  { atomicNumber: 51, symbol: "Sb", name: "Antimony", row: 5, col: 15 },
  { atomicNumber: 52, symbol: "Te", name: "Tellurium", row: 5, col: 16 },
  { atomicNumber: 53, symbol: "I", name: "Iodine", row: 5, col: 17 },
  { atomicNumber: 54, symbol: "Xe", name: "Xenon", row: 5, col: 18 },
  // Row 6
  { atomicNumber: 55, symbol: "Cs", name: "Caesium", row: 6, col: 1 },
  { atomicNumber: 56, symbol: "Ba", name: "Barium", row: 6, col: 2 },
  { atomicNumber: 57, symbol: "La", name: "Lanthanum", row: 6, col: 3 },
  { atomicNumber: 72, symbol: "Hf", name: "Hafnium", row: 6, col: 4 },
  { atomicNumber: 73, symbol: "Ta", name: "Tantalum", row: 6, col: 5 },
  { atomicNumber: 74, symbol: "W", name: "Tungsten", row: 6, col: 6 },
  { atomicNumber: 75, symbol: "Re", name: "Rhenium", row: 6, col: 7 },
  { atomicNumber: 76, symbol: "Os", name: "Osmium", row: 6, col: 8 },
  { atomicNumber: 77, symbol: "Ir", name: "Iridium", row: 6, col: 9 },
  { atomicNumber: 78, symbol: "Pt", name: "Platinum", row: 6, col: 10 },
  { atomicNumber: 79, symbol: "Au", name: "Gold", row: 6, col: 11 },
  { atomicNumber: 80, symbol: "Hg", name: "Mercury", row: 6, col: 12 },
  { atomicNumber: 81, symbol: "Tl", name: "Thallium", row: 6, col: 13 },
  { atomicNumber: 82, symbol: "Pb", name: "Lead", row: 6, col: 14 },
  { atomicNumber: 83, symbol: "Bi", name: "Bismuth", row: 6, col: 15 },
  { atomicNumber: 84, symbol: "Po", name: "Polonium", row: 6, col: 16 },
  { atomicNumber: 85, symbol: "At", name: "Astatine", row: 6, col: 17 },
  { atomicNumber: 86, symbol: "Rn", name: "Radon", row: 6, col: 18 },
  // Row 7
  { atomicNumber: 87, symbol: "Fr", name: "Francium", row: 7, col: 1 },
  { atomicNumber: 88, symbol: "Ra", name: "Radium", row: 7, col: 2 },
  { atomicNumber: 89, symbol: "Ac", name: "Actinium", row: 7, col: 3 },
  { atomicNumber: 104, symbol: "Rf", name: "Rutherfordium", row: 7, col: 4 },
  { atomicNumber: 105, symbol: "Db", name: "Dubnium", row: 7, col: 5 },
  { atomicNumber: 106, symbol: "Sg", name: "Seaborgium", row: 7, col: 6 },
  { atomicNumber: 107, symbol: "Bh", name: "Bohrium", row: 7, col: 7 },
  { atomicNumber: 108, symbol: "Hs", name: "Hassium", row: 7, col: 8 },
  { atomicNumber: 109, symbol: "Mt", name: "Meitnerium", row: 7, col: 9 },
  { atomicNumber: 110, symbol: "Ds", name: "Darmstadtium", row: 7, col: 10 },
  { atomicNumber: 111, symbol: "Rg", name: "Roentgenium", row: 7, col: 11 },
  { atomicNumber: 112, symbol: "Cn", name: "Copernicium", row: 7, col: 12 },
  { atomicNumber: 113, symbol: "Nh", name: "Nihonium", row: 7, col: 13 },
  { atomicNumber: 114, symbol: "Fl", name: "Flerovium", row: 7, col: 14 },
  { atomicNumber: 115, symbol: "Mc", name: "Moscovium", row: 7, col: 15 },
  { atomicNumber: 116, symbol: "Lv", name: "Livermorium", row: 7, col: 16 },
  { atomicNumber: 117, symbol: "Ts", name: "Tennessine", row: 7, col: 17 },
  { atomicNumber: 118, symbol: "Og", name: "Oganesson", row: 7, col: 18 },
  // Row 8 — Lanthanides (Ce–Lu)
  { atomicNumber: 58, symbol: "Ce", name: "Cerium", row: 9, col: 4 },
  { atomicNumber: 59, symbol: "Pr", name: "Praseodymium", row: 9, col: 5 },
  { atomicNumber: 60, symbol: "Nd", name: "Neodymium", row: 9, col: 6 },
  { atomicNumber: 61, symbol: "Pm", name: "Promethium", row: 9, col: 7 },
  { atomicNumber: 62, symbol: "Sm", name: "Samarium", row: 9, col: 8 },
  { atomicNumber: 63, symbol: "Eu", name: "Europium", row: 9, col: 9 },
  { atomicNumber: 64, symbol: "Gd", name: "Gadolinium", row: 9, col: 10 },
  { atomicNumber: 65, symbol: "Tb", name: "Terbium", row: 9, col: 11 },
  { atomicNumber: 66, symbol: "Dy", name: "Dysprosium", row: 9, col: 12 },
  { atomicNumber: 67, symbol: "Ho", name: "Holmium", row: 9, col: 13 },
  { atomicNumber: 68, symbol: "Er", name: "Erbium", row: 9, col: 14 },
  { atomicNumber: 69, symbol: "Tm", name: "Thulium", row: 9, col: 15 },
  { atomicNumber: 70, symbol: "Yb", name: "Ytterbium", row: 9, col: 16 },
  { atomicNumber: 71, symbol: "Lu", name: "Lutetium", row: 9, col: 17 },
  // Row 9 — Actinides (Th–Lr)
  { atomicNumber: 90, symbol: "Th", name: "Thorium", row: 10, col: 4 },
  { atomicNumber: 91, symbol: "Pa", name: "Protactinium", row: 10, col: 5 },
  { atomicNumber: 92, symbol: "U", name: "Uranium", row: 10, col: 6 },
  { atomicNumber: 93, symbol: "Np", name: "Neptunium", row: 10, col: 7 },
  { atomicNumber: 94, symbol: "Pu", name: "Plutonium", row: 10, col: 8 },
  { atomicNumber: 95, symbol: "Am", name: "Americium", row: 10, col: 9 },
  { atomicNumber: 96, symbol: "Cm", name: "Curium", row: 10, col: 10 },
  { atomicNumber: 97, symbol: "Bk", name: "Berkelium", row: 10, col: 11 },
  { atomicNumber: 98, symbol: "Cf", name: "Californium", row: 10, col: 12 },
  { atomicNumber: 99, symbol: "Es", name: "Einsteinium", row: 10, col: 13 },
  { atomicNumber: 100, symbol: "Fm", name: "Fermium", row: 10, col: 14 },
  { atomicNumber: 101, symbol: "Md", name: "Mendelevium", row: 10, col: 15 },
  { atomicNumber: 102, symbol: "No", name: "Nobelium", row: 10, col: 16 },
  { atomicNumber: 103, symbol: "Lr", name: "Lawrencium", row: 10, col: 17 },
];

/** Total rows in the grid: 7 main + 1 gap + 2 f-block = 10 */
export const GRID_ROWS = 10;
export const GRID_COLS = 18;
/** Row 8 is a visual gap between main table and lanthanides/actinides */
export const GAP_ROW = 8;
