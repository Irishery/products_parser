import MenuParser from './getMenu';
import Config from './types/types';
import config from './config.json';


// const 
const menuParser = new MenuParser(config);
menuParser.getMenu().then((menu) => {
  console.log(menu);
});
