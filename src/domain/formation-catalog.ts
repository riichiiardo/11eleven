import { FUTBIN_FORMATIONS } from "./futbin-formations";
/** Catálogo táctico solicitado; los códigos incluyen la variante para persistirla. */
export const LEGACY_FORMATION_GROUPS = [
  {
    defenders: 4,
    families: [
      {
        name: "4-4-2",
        variants: [
          {
            code: "4-4-2 · Plana",
            label: "4-4-2",
            variant: "Plana",
            rows: [
              ["DC", "DC"],
              ["MI", "MC", "MC", "MD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-1-2-1-2 · Rombo estrecho",
            label: "4-1-2-1-2",
            variant: "Rombo estrecho",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MC", "MC"],
              ["MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-1-2-1-2 · Rombo abierto",
            label: "4-1-2-1-2",
            variant: "Rombo abierto",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MI", "MD"],
              ["MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-4-1-1",
        variants: [
          {
            code: "4-4-1-1 · Plana",
            label: "4-4-1-1",
            variant: "Plana",
            rows: [
              ["DC"],
              ["SD"],
              ["MI", "MC", "MC", "MD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-4-1-1 · Mediocampo",
            label: "4-4-1-1",
            variant: "Mediocampo",
            rows: [
              ["DC"],
              ["MCO"],
              ["MI", "MC", "MC", "MD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-3-3",
        variants: [
          {
            code: "4-3-3 · Plana",
            label: "4-3-3",
            variant: "Plana",
            rows: [
              ["EI", "DC", "ED"],
              ["MC", "MC", "MC"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-3-3 · Contención",
            label: "4-3-3",
            variant: "Contención",
            rows: [
              ["EI", "DC", "ED"],
              ["MC", "MC"],
              ["MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-3-3 · Ofensiva",
            label: "4-3-3",
            variant: "Ofensiva",
            rows: [
              ["EI", "DC", "ED"],
              ["MCO"],
              ["MC", "MC"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-3-3 · Falso 9",
            label: "4-3-3",
            variant: "Falso 9",
            rows: [
              ["EI", "ED"],
              ["SD"],
              ["MC", "MC"],
              ["MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-3-3 · Defensiva",
            label: "4-3-3",
            variant: "Defensiva",
            rows: [
              ["EI", "DC", "ED"],
              ["MC"],
              ["MCD", "MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-2-3-1",
        variants: [
          {
            code: "4-2-3-1 · Estrecha",
            label: "4-2-3-1",
            variant: "Estrecha",
            rows: [
              ["DC"],
              ["MCO", "MCO", "MCO"],
              ["MCD", "MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-2-3-1 · Abierta",
            label: "4-2-3-1",
            variant: "Abierta",
            rows: [
              ["DC"],
              ["MI", "MCO", "MD"],
              ["MCD", "MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-2-1-3",
        variants: [
          {
            code: "4-2-1-3 · Doble contención",
            label: "4-2-1-3",
            variant: "Doble contención",
            rows: [
              ["EI", "DC", "ED"],
              ["MCO"],
              ["MCD", "MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-3-1-2",
        variants: [
          {
            code: "4-3-1-2 · Tres MC y un MCO",
            label: "4-3-1-2",
            variant: "Tres MC y un MCO",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MC", "MC", "MC"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-3-2-1",
        variants: [
          {
            code: "4-3-2-1 · Dos segundos delanteros",
            label: "4-3-2-1",
            variant: "Dos segundos delanteros",
            rows: [
              ["DC"],
              ["SD", "SD"],
              ["MC", "MC", "MC"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-2-2-2",
        variants: [
          {
            code: "4-2-2-2 · Dos MCD y dos MCO",
            label: "4-2-2-2",
            variant: "Dos MCD y dos MCO",
            rows: [
              ["DC", "DC"],
              ["MCO", "MCO"],
              ["MCD", "MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-1-4-1",
        variants: [
          {
            code: "4-1-4-1 · Pivote y línea de cuatro",
            label: "4-1-4-1",
            variant: "Pivote y línea de cuatro",
            rows: [
              ["DC"],
              ["MI", "MC", "MC", "MD"],
              ["MCD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-5-1",
        variants: [
          {
            code: "4-5-1 · Plana",
            label: "4-5-1",
            variant: "Plana",
            rows: [
              ["DC"],
              ["MI", "MC", "MC", "MC", "MD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "4-5-1 · Ofensiva",
            label: "4-5-1",
            variant: "Ofensiva",
            rows: [
              ["DC"],
              ["MCO", "MCO"],
              ["MI", "MC", "MD"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "4-2-4",
        variants: [
          {
            code: "4-2-4 · Dos MC y cuatro atacantes",
            label: "4-2-4",
            variant: "Dos MC y cuatro atacantes",
            rows: [
              ["EI", "DC", "DC", "ED"],
              ["MC", "MC"],
              ["LI", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
    ],
  },
  {
    defenders: 3,
    families: [
      {
        name: "3-4-3",
        variants: [
          {
            code: "3-4-3 · Plana",
            label: "3-4-3",
            variant: "Plana",
            rows: [
              ["EI", "DC", "ED"],
              ["MI", "MC", "MC", "MD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
          {
            code: "3-4-3 · Rombo",
            label: "3-4-3",
            variant: "Rombo",
            rows: [
              ["EI", "DC", "ED"],
              ["MCO"],
              ["MI", "MD"],
              ["MCD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
        ],
      },
      {
        name: "3-4-2-1",
        variants: [
          {
            code: "3-4-2-1 · Dos MCO",
            label: "3-4-2-1",
            variant: "Dos MCO",
            rows: [
              ["DC"],
              ["MCO", "MCO"],
              ["MI", "MC", "MC", "MD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
        ],
      },
      {
        name: "3-4-1-2",
        variants: [
          {
            code: "3-4-1-2 · Un MCO y dos delanteros",
            label: "3-4-1-2",
            variant: "Un MCO y dos delanteros",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MI", "MC", "MC", "MD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
        ],
      },
      {
        name: "3-5-2",
        variants: [
          {
            code: "3-5-2 · Doble contención",
            label: "3-5-2",
            variant: "Doble contención",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MI", "MCD", "MCD", "MD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
        ],
      },
      {
        name: "3-1-4-2",
        variants: [
          {
            code: "3-1-4-2 · Pivote y línea de cuatro",
            label: "3-1-4-2",
            variant: "Pivote y línea de cuatro",
            rows: [
              ["DC", "DC"],
              ["MI", "MC", "MC", "MD"],
              ["MCD"],
              ["DFC", "DFC", "DFC"],
            ],
          },
        ],
      },
    ],
  },
  {
    defenders: 5,
    families: [
      {
        name: "5-4-1",
        variants: [
          {
            code: "5-4-1 · Plana",
            label: "5-4-1",
            variant: "Plana",
            rows: [
              ["DC"],
              ["MI", "MC", "MC", "MD"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "5-4-1 · Rombo",
            label: "5-4-1",
            variant: "Rombo",
            rows: [
              ["DC"],
              ["MCO"],
              ["MC", "MC"],
              ["MCD"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "5-3-2",
        variants: [
          {
            code: "5-3-2 · Plana",
            label: "5-3-2",
            variant: "Plana",
            rows: [
              ["DC", "DC"],
              ["MC", "MC", "MC"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
          {
            code: "5-3-2 · Contención",
            label: "5-3-2",
            variant: "Contención",
            rows: [
              ["DC", "DC"],
              ["MC", "MC"],
              ["MCD"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "5-2-1-2",
        variants: [
          {
            code: "5-2-1-2 · Dos MC y un MCO",
            label: "5-2-1-2",
            variant: "Dos MC y un MCO",
            rows: [
              ["DC", "DC"],
              ["MCO"],
              ["MC", "MC"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
      {
        name: "5-2-3",
        variants: [
          {
            code: "5-2-3 · Dos MC y tridente",
            label: "5-2-3",
            variant: "Dos MC y tridente",
            rows: [
              ["EI", "DC", "ED"],
              ["MC", "MC"],
              ["LI", "DFC", "DFC", "DFC", "LD"],
            ],
          },
        ],
      },
    ],
  },
] as const;
export type TacticalFormationCode =
  (typeof LEGACY_FORMATION_GROUPS)[number]["families"][number]["variants"][number]["code"];

/** Current selectable catalogue, verified against the FC27 builder. */
export const FORMATION_GROUPS = ([4, 3, 5] as const).map((defenders) => {
  const options = FUTBIN_FORMATIONS.filter(
    (option) => option.defenders === defenders,
  );
  const names = [...new Set(options.map((option) => option.family))];
  return {
    defenders,
    families: names.map((name) => ({
      name,
      variants: options.filter((option) => option.family === name),
    })),
  };
});
