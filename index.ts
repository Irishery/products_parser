// index.ts
import parser from "./src/productParser";
import config from "./site_config/config_proxy.json";



parser.init(config);
parser.start();
