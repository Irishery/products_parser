// index.ts
import parser from "./productParser";
import config from "./config.json";

parser.init(config);
parser.start();
