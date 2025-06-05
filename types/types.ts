interface menuConf {
    main: string;
    name: string;
    url: string;
    children: {
        main: string;
        name: string;
        url: string;
    };
    
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

export default Config;
