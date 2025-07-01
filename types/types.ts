interface menuConf {
  main: string;
  children: {
    main: string;
    name: string;
    url: string;
  };
  sub_catgs: {
    main: string;
    name: string;
    url: string;
  };
}

interface modifierConf {
  main: string;
  group_name: string;
  subheader: string;
  name: string;
  price: string;
}

namespace Types {
  export interface Proxy {
    host: string;
    port: number;
    user: string;
    pass: string;
  }

  export interface ModifierGroup {
    id: number;
    type: string;
    name: string;
    required: boolean;
    max: number;
    min: number;
    modifiers: Modifier[];
  }

  export interface Modifier {
    id: number;
    name: string;
    group: number;
    price: number;
  }

  export interface ProductPrice {
    id?: string;
    price: number;
    description?: string;
    old_price?: number;
    index?: number;
  }

  export interface Category {
    id: number;
    name: string;
    url: string;
    parent_id?: number;
  }

  export interface Config {
    url: string;
    charset?: string;
    cssmode?: string;
    product: string;
    menu: menuConf;
    product_url?: string;
    selectors: Record<string, string>;
    modifiers_flag: Boolean,
    modifiers: modifierConf;
    follow_url?: boolean;
    export?: string;
    filename?: string;
    delay?: number;
    start_id?: number;
    name?: string;
    company?: string;
    proxy: string;
  }

  export interface Product {
    id: number;
    name: string;
    description: string;
    picture?: string;
    price: ProductPrice[];
    category: number;
    labels?: string[];
    modifiers?: number[];
    parameters: any[];
  }

  export interface ExportData {
    name: string;
    company: string;
    url: string;
    categories: Category[];
    products: Record<string, Product>;
    modifiers_groups: ModifierGroup[];
  }

  export interface ExporterConfig {
    filename?: string;
  }

}

export default Types;
