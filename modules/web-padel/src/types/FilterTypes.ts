export enum FilterType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  PERIOD = 'PERIOD',
  DATE = 'DATE',
}

export interface NumberFilter {
  min?: number;
  max?: number;
}

export interface DateFilter {
  from?: Date;
  to?: Date;
}

export interface TextOptionItem {
  id: string;
  label: string;
}

export interface TextFilter {
  include?: TextOptionItem[];
  exclude?: TextOptionItem[];
}

export interface Filter {
  title: string;
  field: string;
  type: FilterType;
  single?: boolean;
  disableToggle?: boolean;
  sortable?: boolean;
  hideTag?: boolean;
  hideFilter?: boolean;
  icon?: string;
  options?: TextOptionItem[];
  textFilter?: TextFilter;
  numberFilter?: NumberFilter;
  dateFilter?: DateFilter;
}

export namespace Filter {
  export function empty(): Filter {
    return {
      title: '',
      field: '',
      type: FilterType.TEXT,
      sortable: false,
      options: [],
      textFilter: { include: [], exclude: [] },
      numberFilter: {},
      dateFilter: { from: undefined, to: undefined },
    };
  }
}