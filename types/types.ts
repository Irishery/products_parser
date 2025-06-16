interface menuConf {
    main: string;
    children: {
        main: string;
        name: string;
        url: string;
    };
    
}

namespace Types {
  export interface ModifierGroup {
  name: string;
  type: string;
  minimum: number;
  maximum: number;
}

  export interface Category {
    id: number;
    name: string;
    url: string;
  }

  export interface Config {
    url: string;
    charset?: string;
    cssmode?: string;
    product: string;
    menu: menuConf;
    product_url?: string;
    selectors: Record<string, string>;
    follow_url?: boolean;
    export?: string;
    filename?: string;
    delay?: number;
    start_id?: number;
    name?: string;
    company?: string;
  }

  export interface Product {
    id: number;
    name: string;
    description: string;
    picture?: string;
    price?: any[];
    category: number;
    labels?: string[];
    modifiers?: string[];
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
