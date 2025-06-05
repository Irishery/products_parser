// index.ts
import parser from "./parser";
import config from "./config.json";

parser.init(config, {
  get_product: (data, product, dom) => {
    return {
      ...product,
      ...data,
    };
  },
});

parser.start();
