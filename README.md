# 🛒 Меню-парсер интернет-магазинов

Парсит меню, категории и товары с сайтов ресторанов или магазинов. Работает с прокси, поддерживает модификаторы и экспортирует в XML (формат YML).

---

## ⚙️ Возможности

- Парсинг категорий и подкатегорий
- Работа с прокси (автоматический выбор случайного)
- Экспорт в XML (формат YML)
- Кодировка страниц (`utf-8`, `windows-1251`, и др.)
- Настройка через конфиг (`config_proxy.json`)

---

## 📦 Зависимости

Устанавливаются через `package.json`, основные:

- `axios`
- `jsdom`
- `iconv-lite`
- `csstoxpath`
- `https-proxy-agent`
- `tsx` (для запуска)

Установка:

```bash
npm install
````

---

## 🧩 Формат прокси

```txt
IP:PORT:USERNAME:PASSWORD
```

Пример (`proxy.txt` или массив в JSON):

```txt
198.23.239.134:6540:asfsdfsdfsf:i7ob0sdfsdf5nm8s5s
207.244.217.165:6712:sdfsdfsfsdf:sdfsdfsdfsd
...
```

---

## ⚙️ Конфигурация

Файл `config.json`:

```json
{
  "url": "https://example.com/",
  "charset": "utf-8",
  "cssmode": "css",

  "product": ".product-item",

  "selectors": {
    "name": ".product-name",
    "price": ".product-price",
    "url": ".product-link",
    "picture": ".product-image img",
    "description": ".product-description",
    "weight": ".product-weight"
  },

  "menu": {
    "main": ".menu-main-list",
    "children": {
      "main": ".menu-item",
      "name": ".menu-item-name",
      "url": ".menu-item-link"
    },
    "sub_catgs": {
      "main": ".submenu-categories",
      "name": ".submenu-category-name",
      "url": "a"
    }
  },

  "follow_url": true,
  "product_url": "",
  "export": "xml",
  "filename": "export/products",
  "delay": 1000,

  "proxy": "./proxy.txt"
}
```

---

## ▶️ Запуск

```bash
npx tsx index.ts
```

---

## 📤 Экспорт

Результаты сохраняются в XML-файл в формате YML (`name.xml`), включая:

* категории,
* товары

---

## 📋 TODO

* Улучшение логирования (🚧 WIP)
* ~~Поддержка ретраев при неудачных запросах~~ (✅)
* Тесты для устойчивости к невалидной разметке
* Обработка пагинации (в планах)
* Обработка модификаторов (🚧 WIP)
* Убрать из productParser общую логику проекта и вынести её в сущность mainParser
* Убрать валидационные ошибки для дебагера
