// index.ts
import parser from "./src/productParser";
import config from "./site_config/config_fleur.json";

// process.on('unhandledRejection', (reason) => {
//     console.error('🔴 Unhandled rejection:', reason);
// });

parser.init(config);
parser.start();
