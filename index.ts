// index.ts
import parser from "./src/productParser";
import config from "./site_config/config_buket.json";



parser.init(config);
parser.start();
